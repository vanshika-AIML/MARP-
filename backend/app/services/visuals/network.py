"""HTTPS-only, DNS-pinned outbound requests with per-hop validation and bounded bodies."""

import asyncio
import ipaddress
import socket
from urllib.parse import urljoin, urlsplit

import aiohttp
from aiohttp.abc import AbstractResolver

from app.services.visuals.interfaces import VisualError


def public_ip(value):
    try:
        address = ipaddress.ip_address(value)
        if isinstance(address, ipaddress.IPv6Address):
            if address.is_site_local or any(
                address in ipaddress.ip_network(network)
                for network in (
                    "64:ff9b::/96",
                    "64:ff9b:1::/48",
                    "2002::/16",
                    "2001::/32",
                )
            ):
                return False
        mapped = getattr(address, "ipv4_mapped", None)
        if mapped:
            address = mapped
        return address.is_global and not (
            address.is_multicast or address.is_reserved or address.is_unspecified
        )
    except ValueError:
        return False


def validate_url(value):
    try:
        url = urlsplit(value)
        host = (url.hostname or "").rstrip(".").lower()
        if (
            url.scheme != "https"
            or not host
            or url.username
            or url.password
            or url.port not in {None, 443}
            or url.fragment
            or "\\" in value
            or "%" in host
            or any(ord(char) < 33 for char in value)
        ):
            raise ValueError()
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal", ".test")):
            raise ValueError()
        try:
            ipaddress.ip_address(host)
        except ValueError:
            if "." not in host or "%" in host:
                raise ValueError() from None
        else:
            if not public_ip(host):
                raise ValueError()
        return value
    except (ValueError, TypeError):
        raise VisualError("unsafe_media_url") from None


class PublicResolver(AbstractResolver):
    async def resolve(self, host, port=443, family=socket.AF_UNSPEC):
        records = await asyncio.get_running_loop().getaddrinfo(
            host,
            port,
            family=family,
            type=socket.SOCK_STREAM,
        )
        if not records or any(not public_ip(record[4][0]) for record in records):
            raise VisualError("unsafe_media_url")
        # aiohttp connects directly to these checked addresses; it does not resolve again.
        return [
            {
                "hostname": host,
                "host": item[4][0],
                "port": port,
                "family": item[0],
                "proto": item[2],
                "flags": socket.AI_NUMERICHOST,
            }
            for item in records
        ]

    async def close(self):
        pass


class SafeHTTP:
    async def request(
        self,
        method,
        url,
        *,
        headers=None,
        params=None,
        data=None,
        max_bytes=2_000_000,
        deadline_seconds=20,
        redirects=False,
    ):
        validate_url(url)
        connector = aiohttp.TCPConnector(resolver=PublicResolver(), use_dns_cache=False)
        try:
            async with aiohttp.ClientSession(
                connector=connector,
                trust_env=False,
                auto_decompress=False,
                timeout=aiohttp.ClientTimeout(total=deadline_seconds, connect=8),
            ) as client:
                for hop in range(4):
                    validate_url(url)
                    async with client.request(
                        method,
                        url,
                        headers=headers,
                        params=params,
                        data=data,
                        allow_redirects=False,
                    ) as response:
                        if response.status in {301, 302, 303, 307, 308}:
                            if not redirects or method != "GET" or hop == 3:
                                raise VisualError("media_redirect_rejected")
                            url = urljoin(str(response.url), response.headers.get("Location", ""))
                            headers, params = None, None  # Never forward credentials on redirects.
                            continue
                        if response.status >= 400:
                            raise VisualError("visual_provider_error")
                        if response.status != 200:
                            raise VisualError("visual_provider_error")
                        if response.headers.get("Content-Encoding", "identity") != "identity":
                            raise VisualError("compressed_media_rejected")
                        if response.content_length and response.content_length > max_bytes:
                            raise VisualError("media_too_large")
                        body = bytearray()
                        async for chunk in response.content.iter_chunked(65536):
                            body.extend(chunk)
                            if len(body) > max_bytes:
                                raise VisualError("media_too_large")
                        return bytes(body), response.headers.get("Content-Type", "").split(";")[0]
        except VisualError:
            raise
        except (aiohttp.ClientError, OSError, TimeoutError, ValueError):
            raise VisualError("visual_provider_unavailable") from None
        raise VisualError("visual_provider_unavailable")

    async def download(self, url, limit):
        return await self.request("GET", url, max_bytes=limit, redirects=True)

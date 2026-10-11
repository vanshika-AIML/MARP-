from io import BytesIO

from PIL import Image


def image_bytes(color="red", size=(1200, 675)):
    stream = BytesIO()
    Image.new("RGB", size, color).save(stream, format="PNG")
    return stream.getvalue()

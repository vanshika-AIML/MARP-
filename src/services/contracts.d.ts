export type UUID = string;
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface Presentation { id: UUID; title: string; description: string | null; markdown: string; theme_id: UUID | null; status: string; created_at: string; updated_at: string; }
export interface GenerationRequest { action: string; prompt: string; presentation_id?: UUID; slide_id?: UUID; source_ids?: UUID[]; options?: { theme?: string; tone?: string; slide_count?: number; persist?: boolean; slide_ids?: UUID[] }; }
export interface GenerationResult { action: string; markdown: string; presentation_id: UUID | null; persisted: boolean; presentation: { title: string }; reorder_suggestions?: { slide_ids: UUID[]; rationale: string }; }
export interface GenerationJob { id: UUID; status: JobStatus; progress: number; result: GenerationResult | null; error: { code: string; message: string } | null; }
export interface ProgressEvent { event: string; job_id?: UUID; source_id?: UUID; progress: number; message: string; data: Record<string, unknown>; updated_at?: string; }
export interface UploadedSource { id: UUID; original_filename: string; status: 'uploaded' | 'processing' | 'ready' | 'failed'; extracted_text: string | null; error: { code?: string; message?: string } | string | null; }
export interface RequestOptions extends RequestInit { timeoutMs?: number; responseType?: 'json' | 'blob' | 'text'; }

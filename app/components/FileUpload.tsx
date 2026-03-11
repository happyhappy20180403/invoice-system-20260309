'use client';

import { useState, useCallback, useRef } from 'react';
import type { ParsedItem } from '@/lib/ocr/parser';

interface OcrResponse {
  uploadId: number;
  filename: string;
  rawText: string;
  items: ParsedItem[];
  isMock: boolean;
}

interface Props {
  onOcrComplete: (result: OcrResponse) => void;
  onError: (message: string) => void;
}

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png';
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPTED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

export default function FileUpload({ onOcrComplete, onError }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<{
    name: string;
    size: string;
    type: string;
    dataUrl?: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_MIME.has(file.type)) {
      return `Unsupported file type: ${file.type || 'unknown'}. Please upload a PDF, JPG, or PNG.`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File too large (${formatSize(file.size)}). Maximum size is ${MAX_SIZE_MB} MB.`;
    }
    return null;
  };

  const generatePreview = useCallback((file: File) => {
    const base: { name: string; size: string; type: string; dataUrl?: string } = {
      name: file.name,
      size: formatSize(file.size),
      type: file.type,
    };

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => {
        setPreview({ ...base, dataUrl: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(base);
    }
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        onError(validationError);
        return;
      }

      generatePreview(file);
      setIsUploading(true);
      setProgress(0);

      // Simulate initial progress while uploading
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 85));
      }, 200);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/ocr', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setProgress(100);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            (errData as { error?: string }).error ??
              `Server error: ${response.status}`,
          );
        }

        const result = (await response.json()) as OcrResponse;
        onOcrComplete(result);
      } catch (err) {
        clearInterval(progressInterval);
        setProgress(0);
        onError(String(err));
      } finally {
        setIsUploading(false);
      }
    },
    [generatePreview, onOcrComplete, onError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleClick = () => {
    if (!isUploading) inputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload file area"
        onClick={handleClick}
        onKeyDown={e => e.key === 'Enter' && handleClick()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition',
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50',
          isUploading ? 'cursor-not-allowed opacity-60' : '',
        ].join(' ')}
      >
        {/* Upload icon */}
        <svg
          className="mb-3 h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <p className="text-sm font-medium text-gray-700">
          {isUploading ? 'Processing...' : 'Drop your file here or click to browse'}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          PDF, JPG, PNG — max {MAX_SIZE_MB} MB
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleInputChange}
          disabled={isUploading}
        />
      </div>

      {/* Progress bar */}
      {isUploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Uploading and running OCR...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Preview thumbnail */}
      {preview && !isUploading && (
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
          {preview.dataUrl ? (
            // Image preview
            <img
              src={preview.dataUrl}
              alt="Preview"
              className="h-16 w-16 rounded object-cover"
            />
          ) : (
            // PDF icon
            <div className="flex h-16 w-16 items-center justify-center rounded bg-red-100">
              <svg
                className="h-8 w-8 text-red-500"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-800">
              {preview.name}
            </p>
            <p className="text-xs text-gray-500">
              {preview.type} &mdash; {preview.size}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setProgress(0);
            }}
            className="shrink-0 text-gray-400 hover:text-red-500"
            aria-label="Remove file"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

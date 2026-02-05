'use client';

import { cn } from '@/lib/utils';
import { useCallback, useState, type ChangeEvent, type DragEvent } from 'react';

interface FileUploadProps {
  label?: string;
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;
  error?: string;
  hint?: string;
  onChange: (files: File[]) => void;
  onError?: (error: string) => void;
  value?: File[];
  className?: string;
  disabled?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function FileUpload({
  label,
  accept,
  maxSize = 5 * 1024 * 1024, // 5MB default
  multiple = false,
  error,
  hint,
  onChange,
  onError,
  value = [],
  className,
  disabled = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const validateFiles = useCallback(
    (files: FileList | null): File[] => {
      if (!files) return [];

      const validFiles: File[] = [];
      const errors: string[] = [];

      Array.from(files).forEach((file) => {
        // Check file size
        if (file.size > maxSize) {
          errors.push(`${file.name} excede el tamaño máximo de ${formatFileSize(maxSize)}`);
          return;
        }

        // Check file type if accept is specified
        if (accept) {
          const acceptedTypes = accept.split(',').map((t) => t.trim().toLowerCase());
          const fileType = file.type.toLowerCase();
          const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;

          const isValid = acceptedTypes.some((type) => {
            if (type.startsWith('.')) {
              return fileExt === type;
            }
            if (type.endsWith('/*')) {
              return fileType.startsWith(type.replace('/*', '/'));
            }
            return fileType === type;
          });

          if (!isValid) {
            errors.push(`${file.name} no es un tipo de archivo permitido`);
            return;
          }
        }

        validFiles.push(file);
      });

      if (errors.length > 0 && onError) {
        onError(errors.join('. '));
      }

      return multiple ? validFiles : validFiles.slice(0, 1);
    },
    [accept, maxSize, multiple, onError]
  );

  const handleDrag = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      if (e.type === 'dragenter' || e.type === 'dragover') {
        setIsDragging(true);
      } else if (e.type === 'dragleave' || e.type === 'drop') {
        setIsDragging(false);
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      setIsDragging(false);
      const validFiles = validateFiles(e.dataTransfer.files);
      if (validFiles.length > 0) {
        onChange(multiple ? [...value, ...validFiles] : validFiles);
      }
    },
    [disabled, validateFiles, onChange, multiple, value]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const validFiles = validateFiles(e.target.files);
      if (validFiles.length > 0) {
        onChange(multiple ? [...value, ...validFiles] : validFiles);
      }
      // Reset input
      e.target.value = '';
    },
    [validateFiles, onChange, multiple, value]
  );

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = value.filter((_, i) => i !== index);
      onChange(newFiles);
    },
    [value, onChange]
  );

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-colors',
          isDragging
            ? 'border-brand bg-brand-light'
            : error
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        <div className="text-center">
          <svg
            className={cn(
              'mx-auto h-12 w-12',
              isDragging ? 'text-brand' : 'text-gray-400'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            />
          </svg>
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-brand hover:text-brand-hover">
                Haz clic para subir
              </span>{' '}
              o arrastra y suelta
            </p>
            {accept && (
              <p className="mt-1 text-xs text-gray-500">
                Formatos: {accept}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Máximo {formatFileSize(maxSize)}
            </p>
          </div>
        </div>
      </div>

      {/* File list */}
      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0">
                <svg
                  className="w-5 h-5 text-gray-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="text-sm text-gray-700 truncate">{file.name}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  ({formatFileSize(file.size)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                aria-label={`Eliminar ${file.name}`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
    </div>
  );
}

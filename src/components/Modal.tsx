import React from 'react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  maxWidthClass?: string;
};

export default function Modal({ isOpen, onClose, children, title, maxWidthClass = 'max-w-md' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @media print {
          .modal-backdrop {
            position: static !important;
            background: none !important;
            backdrop-filter: none !important;
          }
          .modal-content {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .modal-header {
            display: none !important;
          }
        }
      `}</style>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999] modal-backdrop"
        onClick={onClose}
      >
        <div
          className={`bg-white rounded-2xl shadow-xl w-full ${maxWidthClass} p-6 m-4 modal-content`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4 modal-header">
            <h3 className="text-xl font-bold">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
              aria-label="Close modal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div>{children}</div>
        </div>
      </div>
    </>
  );
} 
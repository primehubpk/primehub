'use client';

import BulkProductEditor from './BulkProductEditor';

export default function BulkProductEditorLayout() {
  return (
    <div className="bulk-editor-layout-fix">
      <BulkProductEditor />
      <style jsx global>{`
        .bulk-editor-layout-fix article {
          display: flex;
          flex-direction: column;
        }

        .bulk-editor-layout-fix article > * {
          order: 7;
        }

        .bulk-editor-layout-fix article > div:nth-of-type(2) {
          order: 1;
        }

        .bulk-editor-layout-fix article > div:nth-of-type(1) {
          order: 2;
          margin-top: 0.75rem;
        }

        .bulk-editor-layout-fix article > div:nth-of-type(3) {
          order: 3;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.78fr) minmax(0, 0.68fr) minmax(0, 1.49fr);
        }

        .bulk-editor-layout-fix article > div:nth-of-type(4) {
          order: 4;
        }

        .bulk-editor-layout-fix article > div:nth-of-type(5) {
          order: 5;
        }

        .bulk-editor-layout-fix article > p {
          order: 6;
        }

        .bulk-editor-layout-fix article > div:nth-of-type(6) {
          order: 7;
        }

        @media (min-width: 640px) {
          .bulk-editor-layout-fix article > div:nth-of-type(3) {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

/**
 * update_layout.js
 * app/(main)/layout.tsx に BottomNav を組み込む
 */
const fs = require('fs');
const path = require('path');

const content = `import { BottomNav } from '@/components/layout/BottomNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
`;

const targetPath = path.join(process.cwd(), 'app/(main)/layout.tsx');
fs.writeFileSync(targetPath, content.trim() + '\n', 'utf8');
console.log('✅ app/(main)/layout.tsx updated successfully!');
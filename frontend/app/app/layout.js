import { readFile } from 'fs/promises';
import path from 'path';
import { Suspense } from 'react';

import AppAuthGate from '../../components/AppAuthGate';
import Sidebar from '../../components/Sidebar';

async function loadProductGuide() {
  try {
    const guidePath = path.join(process.cwd(), '..', 'shared', 'danaa_product_guide.v1.json');
    const raw = await readFile(guidePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }) {
  const productGuide = await loadProductGuide();

  return (
    <AppAuthGate>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-cream-200 text-nature-900">
        <Suspense fallback={null}>
          <Sidebar productGuide={productGuide} />
        </Suspense>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
      </div>
    </AppAuthGate>
  );
}

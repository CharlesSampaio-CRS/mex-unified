'use client'

import ImportSnapshot from '@/components/ImportSnapshot'

export default function ImportPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Importar Snapshot do MongoDB
        </h1>
        <ImportSnapshot />
      </div>
    </div>
  )
}

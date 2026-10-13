export function GET() {
  return Response.json(
    {
      name: 'Mon Cher Savon — Painel',
      short_name: 'Painel',
      description: 'Vendas, sabonetes e estoque da Mon Cher Savon',
      start_url: '/painel',
      scope: '/painel/',
      display: 'standalone',
      background_color: '#F7F3EA',
      theme_color: '#3F5A43',
      lang: 'pt-BR',
      icons: [
        { src: '/icons/painel-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/painel-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/painel-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}

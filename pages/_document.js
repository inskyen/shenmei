import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="zh-Hant-TW">
      <Head>
        <link rel="icon" href="/brand/butterfly.svg?v=2" type="image/svg+xml" />
        <link rel="icon" href="/brand/butterfly.png?v=2" type="image/png" sizes="1024x1024" />
        <link rel="apple-touch-icon" href="/brand/butterfly.png?v=2" />
        <meta property="og:site_name" content="審美者" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://shenmei.org/brand/butterfly.png?v=2" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="採樣器黑白蝴蝶圖標" />
        <meta property="og:image:width" content="1024" />
        <meta property="og:image:height" content="1024" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:image" content="https://shenmei.org/brand/butterfly.png?v=2" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

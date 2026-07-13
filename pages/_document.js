import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="zh-Hant-TW">
      <Head>
        <link rel="icon" href="/brand/butterfly.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/brand/butterfly.png" />
        <meta property="og:site_name" content="審美者" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://shenmei.org/brand/butterfly.png" />
        <meta property="og:image:width" content="1024" />
        <meta property="og:image:height" content="1024" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:image" content="https://shenmei.org/brand/butterfly.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

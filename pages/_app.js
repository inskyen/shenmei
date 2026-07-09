import "@/styles/globals.css";
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="referrer" content="no-referrer" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

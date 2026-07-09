import "@/styles/globals.css";
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    const rememberHomeScroll = (nextUrl) => {
      // 只在離開首頁時記錄位置。回到首頁後由首頁資料載入完成時還原，
      // 讓從策展詳情返回的體感更接近原生 App 的「回到原本那張卡」。
      if (router.pathname === '/' && nextUrl !== '/') {
        window.sessionStorage.setItem('shenmei:home-scroll-y', String(window.scrollY));
      }
    };

    router.events.on('routeChangeStart', rememberHomeScroll);

    return () => {
      router.events.off('routeChangeStart', rememberHomeScroll);
    };
  }, [router]);

  return (
    <>
      <Head>
        <meta name="referrer" content="no-referrer" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

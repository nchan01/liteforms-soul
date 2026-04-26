import type { AppProps } from "next/app"
import Head from "next/head"
import { Toaster } from "react-hot-toast"
import "../src/styles/globals.css"

export default function LiteformsApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Liteforms — Share AI Souls</title>
      </Head>
      <Component {...pageProps} />
      <Toaster position="top-center" />
    </>
  )
}

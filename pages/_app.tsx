import type { AppProps } from "next/app";
import Layout from "../components/Layout";
import Head from "next/head";
import "../styles/globals.css";

export default function MyApp({ Component, pageProps }: AppProps) {
    return (
        <Layout>
            <Head>Saffron | The UI for SpiceDB</Head>
            <Component {...pageProps} />
        </Layout>
    );
}

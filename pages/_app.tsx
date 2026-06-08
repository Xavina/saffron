import type { AppProps } from "next/app";
import Layout from "../components/Layout";
import Head from "next/head";
import "../styles/globals.css";
import ThemeProvider from "@/components/ThemeProvider";

const configuredTheme = process.env.ACTIVE_THEME;

export default function MyApp({ Component, pageProps }: AppProps) {
    return (
        <ThemeProvider configuredTheme={configuredTheme}>
            <Layout>
                <Head>Saffron | The UI for SpiceDB</Head>
                <Component {...pageProps} />
            </Layout>
        </ThemeProvider>
    );
}

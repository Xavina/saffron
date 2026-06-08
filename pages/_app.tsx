import type { AppProps } from "next/app";
import Layout from "../components/Layout";
import Head from "next/head";
import "../styles/globals.css";
import ThemeProvider from "@/components/ThemeProvider";

let configuredTheme: string | undefined;
try {
  const config = require("../themes.config.json");
  configuredTheme = config?.activeTheme;
} catch {
  // themes.config.json doesn't exist yet, that's OK
}

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

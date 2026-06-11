import { Html, Head, Main, NextScript } from "next/document";

let activeThemeFavicon = "/saffron.png";
try {
    const activeTheme = process.env.ACTIVE_THEME || "saffron";
    const { THEME_META } = require("../lib/generated/themes");
    activeThemeFavicon = THEME_META[activeTheme]?.favicon ?? activeThemeFavicon;
} catch {
    // fallback to default if generated file not yet available
}

export default function Document() {
    return (
        <Html lang="en" data-theme="saffron" data-color-mode="light">
            <Head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Leckerli+One&family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet"></link>
                <link rel="icon" href={activeThemeFavicon} />
                <link rel="apple-touch-icon" href={activeThemeFavicon} />
                <link rel="shortcut icon" href={activeThemeFavicon} />
            </Head>
            <body className="antialiased">
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}

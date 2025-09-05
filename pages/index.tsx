// pages/index.tsx
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => ({
    redirect: { destination: "/dashboard", permanent: false },
});

export default function Index() {
    return null;
}

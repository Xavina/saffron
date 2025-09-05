import { useState, ReactNode, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
    IconLayoutDashboard,
    IconCode,
    IconLink,
    IconShieldCheck,
    IconCircleCheck,
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarRightCollapse,
    IconSettings,
    IconTerminal2,
} from "@tabler/icons-react";

interface LayoutProps {
    children: ReactNode;
}

interface NavItem {
    name: string;
    href: string;
    icon: React.ElementType; // Tabler icon component
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem("saffron.sidebar") === "collapsed";
    });

    useEffect(() => {
        if (typeof window === "undefined") return;
        localStorage.setItem("saffron.sidebar", collapsed ? "collapsed" : "expanded");
    }, [collapsed]);

    // Mobile drawer
    const [mobileOpen, setMobileOpen] = useState(false);

    const router = useRouter();

    const navigation: NavItem[] = [
        { name: "Dashboard", href: "/dashboard", icon: IconLayoutDashboard },
        { name: "Schema", href: "/schema", icon: IconCode },
        { name: "Relationships", href: "/relationships", icon: IconLink },
        { name: "Permissions", href: "/permissions", icon: IconShieldCheck },
        { name: "Check", href: "/check", icon: IconCircleCheck },
        { name: "Terminal", href: "/terminal", icon: IconTerminal2 },
    ];

    const isActive = (href: string): boolean =>
        href === "/" ? router.pathname === "/" : router.pathname.startsWith(href);

    // Main padding depends on desktop collapsed state
    const mainPad = collapsed ? "lg:pl-16" : "lg:pl-64";

    // Shared nav list (used in both mobile + desktop)
    const NavList = ({ compact = false }: { compact?: boolean }) => (
        <nav className="mt-6 px-3">
            {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                    <Link
                        key={item.name}
                        href={item.href}
                        title={item.name}
                        className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 ${active
                            ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            } ${compact ? "justify-center" : ""}`}
                        onClick={() => setMobileOpen(false)}
                    >
                        <Icon className={compact ? "pt-0 mt-0" : "mr-3"} aria-hidden="true" />
                        {!compact && <span>{item.name}</span>}
                    </Link>
                );
            })}
        </nav>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Drawer (mobile) */}
            <div className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
                {/* Overlay */}
                <div
                    className={`absolute inset-0 bg-gray-900 transition-opacity ${mobileOpen ? "opacity-40" : "opacity-0"
                        }`}
                    onClick={() => setMobileOpen(false)}
                />
                {/* Panel */}
                <aside
                    className={`absolute left-0 top-0 h-full w-64 bg-white shadow-lg transform transition-transform ${mobileOpen ? "translate-x-0" : "-translate-x-full"
                        }`}
                >
                    <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
                        <div className="flex items-center space-x-2">
                            <div className="w-10 h-10 flex items-center justify-center">
                                <img src="/saffron.png" alt="Saffron logo" className="w-8 h-8" />
                            </div>
                            <span className="text-lg text-white-800 cursive">Saffron</span>
                        </div>
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="p-2 rounded-md text-gray-500 hover:text-gray-700"
                            aria-label="Close menu"
                        >
                            <IconLayoutSidebarLeftCollapse size={20} />
                        </button>
                    </div>
                    <NavList />
                </aside>
            </div>

            {/* Sidebar */}
            <aside
                className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-40 bg-white shadow-lg transition-[width] duration-200 ${collapsed ? "lg:w-16" : "lg:w-64"
                    }`}
            >
                <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 flex items-center justify-center">
                            <img src="/saffron.png" alt="Saffron logo" className="w-8 h-8" />
                        </div>
                        {!collapsed && <span className="text-3xl text-white-800 cursive">Saffron</span>}
                    </div>
                    {/* Collapse/Uncollapse */}
                    {!collapsed && (
                        <button
                            onClick={() => setCollapsed((v) => !v)}
                            className="p-0 rounded-md text-gray-500 hover:text-gray-700"
                            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            <span aria-hidden><IconLayoutSidebarLeftCollapse /></span>
                        </button>
                    )}

                    {collapsed && (
                        <button
                            onClick={() => setCollapsed((v) => !v)}
                            className="ml-5 p-0 rounded-md text-gray-500 hover:text-gray-700"
                            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            <span aria-hidden><IconLayoutSidebarRightCollapse /></span>
                        </button>
                    )}
                </div>

                {/* When collapsed, render icon-only list */}
                <div className="flex-1 overflow-y-auto">
                    <NavList compact={collapsed} />
                </div>
            </aside>

            {/* Header */}
            <div className={`${mainPad} transition-all duration-200`}>
                <div className="bg-white shadow-sm border-b border-gray-200">
                    <div className="px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">

                            {collapsed && (
                                <div className="flex items-center pl-4">
                                    Reserved Space
                                </div>
                            )}

                            {!collapsed && (
                                <div className="flex items-center">
                                    Reserved Space
                                </div>
                            )}

                            <div className="flex items-center space-x-4">
                                <button className="text-white-400 hover:text-gray-600 rounded-md">
                                    <IconSettings />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <main className="py-8">
                    <div className="max-w-90vw mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
                </main>
            </div>
        </div>
    );
};

export default Layout;

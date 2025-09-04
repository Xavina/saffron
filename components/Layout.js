import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const Layout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const router = useRouter();

    const navigation = [
        { name: 'Dashboard', href: '/', icon: '📊' },
        { name: 'Schema', href: '/schema', icon: '🏗️' },
        { name: 'Relationships', href: '/relationships', icon: '🔗' },
        { name: 'Permissions', href: '/permissions', icon: '🔐' },
        { name: 'Check', href: '/check', icon: '✅' },
    ];

    const isActive = (href) => {
        if (href === '/') {
            return router.pathname === '/';
        }
        return router.pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-200 ease-in-out lg:translate-x-0`}>
                <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">S</span>
                        </div>
                        <span className="text-xl font-semibold text-gray-900">SpiceDB UI</span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600"
                    >
                        <span className="sr-only">Close sidebar</span>
                        ✕
                    </button>
                </div>

                <nav className="mt-6">
                    <div className="px-3">
                        {navigation.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 ${
                                    isActive(item.href)
                                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                            >
                                <span className="mr-3 text-lg">{item.icon}</span>
                                {item.name}
                            </Link>
                        ))}
                    </div>
                </nav>
            </div>

            {/* Main content */}
            <div className={`${sidebarOpen ? 'lg:pl-64' : ''} transition-all duration-200`}>
                {/* Top bar */}
                <div className="bg-white shadow-sm border-b border-gray-200">
                    <div className="px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            <div className="flex items-center">
                                <button
                                    onClick={() => setSidebarOpen(!sidebarOpen)}
                                    className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
                                >
                                    <span className="sr-only">Open sidebar</span>
                                    ☰
                                </button>
                                <h1 className="ml-4 lg:ml-0 text-2xl font-semibold text-gray-900">
                                    {navigation.find(item => isActive(item.href))?.name || 'Dashboard'}
                                </h1>
                            </div>
                            <div className="flex items-center space-x-4">
                                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-md">
                                    <span className="sr-only">Settings</span>
                                    Admin
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Page content */}
                <main className="py-8">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                >
                    <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
                </div>
            )}
        </div>
    );
};

export default Layout;
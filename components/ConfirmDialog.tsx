import { IconAlertTriangle } from "@tabler/icons-react";

type ConfirmDialogProps = {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info';
};

const ConfirmDialog = ({
    isOpen,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    variant = 'warning'
}: ConfirmDialogProps) => {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: 'bg-red-100',
            iconColor: 'text-red-600',
            button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
        },
        warning: {
            icon: 'bg-yellow-100',
            iconColor: 'text-yellow-600',
            button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
        },
        info: {
            icon: 'bg-blue-100',
            iconColor: 'text-blue-600',
            button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
        }
    };

    const styles = variantStyles[variant];

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div
                    className="fixed inset-0 transition-opacity bg-black"
                    style={{ opacity: 0.8 }}
                    onClick={onCancel}
                />

                {/* Center modal */}
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
                    &#8203;
                </span>

                {/* Modal panel */}
                <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${styles.icon} sm:mx-0 sm:h-10 sm:w-10`}>
                                <IconAlertTriangle className={styles.iconColor} size={24} />
                            </div>
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    {title}
                                </h3>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-500">
                                        {message}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                        <button
                            type="button"
                            onClick={onConfirm}
                            className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto sm:text-sm ${styles.button}`}
                        >
                            {confirmText}
                        </button>
                        {cancelText !== "" && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:w-auto sm:text-sm"
                            >
                                {cancelText}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;

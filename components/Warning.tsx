// components/Warning.tsx
import { IconAlertHexagon } from "@tabler/icons-react";

type WarningProps = {
    title: string;
    error: string;
};

export default function Warning({ title, error }: WarningProps) {
    return (
        <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center">
                <span className="text-white-600 mr-3 w-8 h-11"><IconAlertHexagon className="h-8 w-8" /></span>
                <div>
                    <h3 className="text-md font-extrabold text-white-800">{title}</h3>
                    <p className="text-sm text-white-700">{error}</p>
                </div>
            </div>
        </div>
    );
}
import React, { useState } from "react";

export type AddRelationshipProps = {
    isOpen: boolean;
    onAdd: (data: { resource: string; relation: string; subject: string }) => void;
    onCancel: () => void;
    loading?: boolean;
    error?: string;
};

const AddRelationship = ({ isOpen, onAdd, onCancel, loading = false, error }: AddRelationshipProps) => {
    const [resource, setResource] = useState("");
    const [relation, setRelation] = useState("");
    const [subject, setSubject] = useState("");

    // Reset fields when opened
    React.useEffect(() => {
        if (isOpen) {
            setResource("");
            setRelation("");
            setSubject("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div
                    className="fixed inset-0 transition-opacity bg-black"
                    style={{ opacity: 0.8 }}
                    onClick={onCancel}
                />
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
                    &#8203;
                </span>
                {/* Modal panel */}
                <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add New Relationship</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Resource (type:id)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g., business:acme-corp"
                                            value={resource}
                                            onChange={e => setResource(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
                                        <input
                                            type="text"
                                            placeholder="e.g., owner"
                                            value={relation}
                                            onChange={e => setRelation(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject (type:id)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g., user:alice"
                                            value={subject}
                                            onChange={e => setSubject(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    {error && <div className="text-red-600 text-sm">{error}</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                        <button
                            type="button"
                            onClick={() => onAdd({ resource, relation, subject })}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? "Saving..." : "Save"}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:w-auto sm:text-sm"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddRelationship;

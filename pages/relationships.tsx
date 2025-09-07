import type { NextPage } from "next";
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { IconAlertHexagon, IconCircleCheck, IconLink, IconReload, IconTrash, IconUsersPlus } from "@tabler/icons-react";
import Warning from "@/components/Warning";

type Relationship = {
    id: string;
    resource: { type: string; id: string };
    relation: string;
    subject: { type: string; id: string; relation?: string };
    createdAt: string;
};

type NewRelationship = { resource: string; relation: string; subject: string };

const Relationships: NextPage = () => {
    const [resources, setResources] = useState<string[]>([]);
    const [relationships, setRelationships] = useState<Relationship[]>([]);
    const [filteredRelationships, setFilteredRelationships] = useState<Relationship[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [showAddModal, setShowAddModal] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [filterNamespace, setFilterNamespace] = useState<string>("all");
    const [newRelationship, setNewRelationship] = useState<NewRelationship>({ resource: "", relation: "", subject: "" });
    const [error, setError] = useState<string>("");
    const [success, setSuccess] = useState<string>("");

    useEffect(() => {
        loadResources();
        loadRelationships();
    }, []);

    useEffect(() => {
        filterRelationships();
    }, [relationships, searchTerm, filterNamespace]);

    const loadResources = async () => {
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch("/api/spicedb/resources");
            if (!res.ok) {
                const errorData = await res.json();

                setError(`Failed to load resources. ${errorData.message}.`);
            } else {
                const data = await res.json();
                const names = (data.resourceTypes ?? []).map((rt: any) => rt.name as string);
                setResources(names);
            }
        } catch (err: any) {
            setError(`Connection error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const loadRelationships = async () => {
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch("/api/spicedb/relationships");
            if (!res.ok) {
                const errorData = await res.json();
                setError(`Failed to load relationships: ${errorData.message}`);
            } else {
                const data = await res.json();
                setRelationships(Array.isArray(data.relationships) ? data.relationships : []);
            }
        } catch (err: any) {
            setError(`Connection error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const filterRelationships = () => {
        let filtered = relationships;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (rel) =>
                    rel.resource.type.toLowerCase().includes(q) ||
                    rel.resource.id.toLowerCase().includes(q) ||
                    rel.relation.toLowerCase().includes(q) ||
                    rel.subject.type.toLowerCase().includes(q) ||
                    rel.subject.id.toLowerCase().includes(q)
            );
        }
        if (filterNamespace !== "all") {
            filtered = filtered.filter((rel) => rel.resource.type === filterNamespace);
        }
        setFilteredRelationships(filtered);
    };

    const addRelationship = async () => {
        setError("");
        setSuccess("");

        if (!newRelationship.resource || !newRelationship.relation || !newRelationship.subject) {
            setError("All fields are required");
            return;
        }

        setIsLoading(true);
        try {
            const [resourceType, resourceId] = newRelationship.resource.split(":");
            const [subjectType, subjectId] = newRelationship.subject.split(":");
            if (!resourceType || !resourceId || !subjectType || !subjectId) {
                throw new Error("Invalid format. Use type:id format for resource and subject");
            }

            const requestBody = {
                resource: { object_type: resourceType, object_id: resourceId },
                relation: newRelationship.relation,
                subject: { object: { object_type: subjectType, object_id: subjectId } },
            };

            const res = await fetch("/api/spicedb/relationships", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });

            if (!res.ok) {
                const errorData = await res.json();
                setError(`Failed to add relationship: ${errorData.message}`);
            } else {
                setSuccess("Relationship added successfully");
                setShowAddModal(false);
                setNewRelationship({ resource: "", relation: "", subject: "" });
                loadRelationships();
            }
        } catch (err: any) {
            setError(`Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteRelationship = async (rel: Relationship) => {
        if (!confirm("Are you sure you want to delete this relationship?")) return;
        setIsLoading(true);
        try {
            await fetch(`/api/spicedb/relationships`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    resourceType: rel.resource.type,
                    resourceId: rel.resource.id,
                    subjectType: rel.subject.type,
                    subjectId: rel.subject.id,
                }),
            });
            loadRelationships();
        } catch {
            setError("Failed to delete relationship");
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <IconLink className="text-orange-300" size={30} aria-hidden />
                        Relationships
                    </h2>
                    <p className="text-gray-400">
                        Manage resource relationships and permissions.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <span className="mr-2"><IconUsersPlus /></span>
                    Add Relationship
                </button>
            </div>

            {error && (
                <Warning
                    title="Relationship Problem"
                    error={error}
                />
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <span className="text-green-600 mr-2"><IconCircleCheck /></span>
                        <div>
                            <h3 className="text-sm font-medium text-green-800">Success</h3>
                            <p className="text-sm text-green-700">{success}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white shadow rounded-lg p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search relationships..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="selectContainer px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-3">
                        <select
                            id="selectResource"
                            value={filterNamespace}
                            onChange={(e) => setFilterNamespace(e.target.value)}
                            className="p-0 m-0"
                        >
                            <option value="all">All Resources</option>
                            {resources.map((ns) => (
                                <option key={ns} value={ns}>
                                    {ns}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={loadRelationships}
                        disabled={isLoading}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        <IconReload className="mr-2" />
                        {isLoading ? "Loading..." : "Refresh"}
                    </button>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                        Relationships ({filteredRelationships.length})
                    </h3>

                    {filteredRelationships.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Resource
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Relation
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Subject
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Created
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredRelationships.map((rel) => (
                                        <tr key={rel.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium mr-2">
                                                        {rel.resource.type}
                                                    </span>
                                                    <span className="text-sm text-gray-900">{rel.resource.id}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                                                    {rel.relation}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium mr-2">
                                                        {rel.subject.type}
                                                    </span>
                                                    <span className="text-sm text-gray-900">
                                                        {rel.subject.id}
                                                        {rel.subject.relation && <span className="text-gray-500">#{rel.subject.relation}</span>}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(rel.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button onClick={() => deleteRelationship(rel)} className="text-red-600 hover:text-red-900 inline-flex items-center gap-1">
                                                    <IconTrash size={16} />
                                                    <span>Delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-gray-400 text-lg mb-2 justify-items-center"><IconLink /></div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No relationships found</h3>
                            <p className="text-gray-500">
                                {searchTerm || filterNamespace !== "all"
                                    ? "Try adjusting your search filters"
                                    : "Add your first relationship to get started"}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {showAddModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" onClick={() => setShowAddModal(false)}>
                            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                        </div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
                            &#8203;
                        </span>
                        <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full z-50">
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
                                                    value={newRelationship.resource}
                                                    onChange={(e) => setNewRelationship({ ...newRelationship, resource: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g., owner"
                                                    value={newRelationship.relation}
                                                    onChange={(e) => setNewRelationship({ ...newRelationship, relation: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject (type:id)</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g., user:alice"
                                                    value={newRelationship.subject}
                                                    onChange={(e) => setNewRelationship({ ...newRelationship, subject: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    onClick={addRelationship}
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Relationships;

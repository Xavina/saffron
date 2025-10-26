import type { NextPage } from "next";
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { IconAlertHexagon, IconCircleCheck, IconLink, IconReload, IconTrash, IconUsersPlus } from "@tabler/icons-react";
import Warning from "@/components/Warning";
import ConfirmDialog from "@/components/ConfirmDialog";
import AddRelationship from "../components/AddRelationship";

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
    const [relationshipToDelete, setRelationshipToDelete] = useState<Relationship | null>(null);

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

    const confirmDelete = async () => {
        if (!relationshipToDelete) return;

        setIsLoading(true);
        setRelationshipToDelete(null);

        try {
            await fetch(`/api/spicedb/relationships`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    resourceType: relationshipToDelete.resource.type,
                    resourceId: relationshipToDelete.resource.id,
                    subjectType: relationshipToDelete.subject.type,
                    subjectId: relationshipToDelete.subject.id,
                }),
            });
            setSuccess("Relationship deleted successfully");
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
                        className="inline-flex items-center justify-center px-3 py-2 border border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-600 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
                                                <button onClick={() => setRelationshipToDelete(rel)} className="text-red-600 hover:text-red-900 inline-flex items-center gap-1">
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

            <ConfirmDialog
                isOpen={relationshipToDelete !== null}
                title="Delete Relationship"
                message={relationshipToDelete ? `Are you sure you want to delete the relationship between ${relationshipToDelete.resource.type}:${relationshipToDelete.resource.id} and ${relationshipToDelete.subject.type}:${relationshipToDelete.subject.id}? This action cannot be undone.` : ''}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setRelationshipToDelete(null)}
            />

            <AddRelationship
                isOpen={showAddModal}
                onAdd={({ resource, relation, subject }) => {
                    setNewRelationship({ resource, relation, subject });
                    addRelationship();
                }}
                onCancel={() => setShowAddModal(false)}
            />
        </div>
    );
};

export default Relationships;

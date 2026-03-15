"use client";

import { useState, useEffect, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import AdminStats from "@/components/AdminStats";
import StudentTable from "@/components/StudentTable";
import CSVUploader from "@/components/CSVUploader";
import CSVStudentTable, { CSVStudent } from "@/components/CSVStudentTable";
import { LayoutDashboard, Users, UsersRound, Trophy, Settings, LogOut, Lightbulb, AlertTriangle, ShieldAlert, Eraser, Database, Download, FileSpreadsheet } from "lucide-react";

interface Student {
    name: string;
    usn: string;
    phone: string;
    email: string;
    branch: string;
    section: string;
    teamId: string | null;
    teamRole: string | null;
    partnerUSN?: string;
    pairStatus?: string;
}

type TabType = "dashboard" | "students" | "registrations" | "teams" | "settings";

export default function AdminPage() {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<TabType>("dashboard");
    const [students, setStudents] = useState<Student[]>([]);
    const [dataLoading, setDataLoading] = useState(false);

    // Reset Database States
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetPassword, setResetPassword] = useState("");
    const [resetPhrase, setResetPhrase] = useState("");
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState("");
    const [clearOtpCodes, setClearOtpCodes] = useState(true);
    const [clearCSV, setClearCSV] = useState(false);

    // Settings States
    const [registrationsOpen, setRegistrationsOpen] = useState(true);
    const [teamFormationOpen, setTeamFormationOpen] = useState(true);
    const [configLoading, setConfigLoading] = useState(false);

    // New stats
    const [csvStudents, setCsvStudents] = useState<CSVStudent[]>([]);
    const [csvStudentCount, setCsvStudentCount] = useState(0);
    const [teamsForming, setTeamsForming] = useState(0);
    const [teamsFull, setTeamsFull] = useState(0);
    const [teamNamesMap, setTeamNamesMap] = useState<Record<string, string>>({});
    const [teamStatusMap, setTeamStatusMap] = useState<Record<string, string>>({});

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const fetchConfig = useCallback(async () => {
        try {
            const docSnap = await getDocs(query(collection(db, "config")));
            if (!docSnap.empty) {
                const data = docSnap.docs[0].data();
                setRegistrationsOpen(data.registrationsOpen ?? true);
                setTeamFormationOpen(data.teamFormationOpen ?? true);
            }
        } catch (error) {
            console.error("Error fetching config:", error);
        }
    }, []);

    const fetchTeamStats = useCallback(async () => {
        try {
            const studentsSnap = await getDocs(collection(db, "students"));
            setCsvStudentCount(studentsSnap.size);
            const csvData: CSVStudent[] = [];
            studentsSnap.forEach((d) => {
                const data = d.data();
                csvData.push({
                    usn: data.usn || d.id,
                    name: data.name || "",
                    email: data.email || "",
                    phone: data.phone || "",
                    branch: data.branch || "",
                    section: data.section || "",
                });
            });
            setCsvStudents(csvData);

            const teamsSnap = await getDocs(collection(db, "teams"));
            let forming = 0, full = 0;
            const names: Record<string, string> = {};
            const statuses: Record<string, string> = {};
            teamsSnap.forEach(d => {
                const data = d.data();
                const status = data.status;
                if (status === "forming") forming++;
                else if (status === "full" || status === "locked") full++;
                if (data.name) names[d.id] = data.name;
                statuses[d.id] = status || "unknown";
            });
            setTeamsForming(forming);
            setTeamsFull(full);
            setTeamNamesMap(names);
            setTeamStatusMap(statuses);
        } catch (error) {
            console.error("Error fetching team stats:", error);
        }
    }, []);

    const fetchStudents = useCallback(async () => {
        setDataLoading(true);
        try {
            const q = query(collection(db, "registrations"), orderBy("registeredAt", "desc"));
            const snapshot = await getDocs(q);
            const data: Student[] = [];
            snapshot.forEach((docSnap) => {
                const d = docSnap.data();
                data.push({
                    name: d.name, usn: d.usn, phone: d.phone, email: d.email || "",
                    branch: d.branch, section: d.section,
                    teamId: d.teamId || null, teamRole: d.teamRole || null,
                    partnerUSN: d.partnerUSN, pairStatus: d.pairStatus,
                });
            });
            setStudents(data);
            await fetchConfig();
            await fetchTeamStats();
        } catch {
            try {
                const q2 = query(collection(db, "registrations"), orderBy("createdAt", "desc"));
                const snapshot = await getDocs(q2);
                const data: Student[] = [];
                snapshot.forEach((docSnap) => {
                    const d = docSnap.data();
                    data.push({
                        name: d.name, usn: d.usn, phone: d.phone, email: d.email || "",
                        branch: d.branch, section: d.section,
                        teamId: d.teamId || null, teamRole: d.teamRole || null,
                        partnerUSN: d.partnerUSN, pairStatus: d.pairStatus,
                    });
                });
                setStudents(data);
                await fetchConfig();
                await fetchTeamStats();
            } catch (error2) {
                console.error("Error fetching data:", error2);
            }
        } finally {
            setDataLoading(false);
        }
    }, [fetchConfig, fetchTeamStats]);

    useEffect(() => {
        if (user) fetchStudents();
    }, [user, fetchStudents]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError("");
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch {
            setLoginError("Invalid email or password. Please try again.");
        } finally {
            setLoginLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        setStudents([]);
    };

    const handleResetDatabase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.email) return;
        if (resetPhrase !== "RESET DATABASE") {
            setResetError("Please type 'RESET DATABASE' exactly.");
            return;
        }

        setResetLoading(true);
        setResetError("");

        try {
            // Re-authenticate to confirm identity
            const credential = EmailAuthProvider.credential(user.email, resetPassword);
            await reauthenticateWithCredential(user, credential);

            // Get a fresh ID token for the server
            const idToken = await user.getIdToken(true);

            // Call server-side reset API (uses admin SDK, bypasses Firestore rules)
            const res = await fetch("/api/admin/reset-database", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken, clearCSV, clearOtpCodes }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to reset database.");
            }

            alert(data.message || "Database has been successfully reset.");
            setShowResetModal(false);
            setResetPassword("");
            setResetPhrase("");
            setClearOtpCodes(true);
            setClearCSV(false);
            await fetchStudents();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Failed to reset database.";
            setResetError(msg);
        } finally {
            setResetLoading(false);
        }
    };

    const toggleRegistrations = async () => {
        setConfigLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Not authenticated");
            const idToken = await user.getIdToken(true);
            const res = await fetch("/api/admin/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken, updates: { registrationsOpen: !registrationsOpen } }),
            });
            if (!res.ok) throw new Error("Failed to update config");
            setRegistrationsOpen(!registrationsOpen);
        } catch {
            console.error("Error updating config");
        } finally {
            setConfigLoading(false);
        }
    };

    const toggleTeamFormation = async () => {
        setConfigLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Not authenticated");
            const idToken = await user.getIdToken(true);
            const res = await fetch("/api/admin/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken, updates: { teamFormationOpen: !teamFormationOpen } }),
            });
            if (!res.ok) throw new Error("Failed to update config");
            setTeamFormationOpen(!teamFormationOpen);
        } catch {
            console.error("Error updating config");
        } finally {
            setConfigLoading(false);
        }
    };

    const totalRegistrations = students.length;
    const branchStats: Record<string, number> = {};
    students.forEach((s) => { branchStats[s.branch] = (branchStats[s.branch] || 0) + 1; });
    const maxBranchCount = Math.max(...Object.values(branchStats), 1);

    const branchColors: Record<string, string> = {
        CSE: "#7c3aed", IOT: "#06b6d4", "AI&ML": "#f59e0b",
        "AI&DS": "#10b981", ISE: "#ef4444", ECE: "#8b5cf6", EEE: "#ec4899",
    };

    // ─── Loading ───
    if (authLoading) {
        return (
            <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)" }}>
                <div className="spinner" style={{ width: 40, height: 40 }} />
            </main>
        );
    }

    // ─── Login ───
    if (!user) {
        return (
            <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "var(--paper)" }}>
                <div style={{ width: "100%", maxWidth: "420px" }} className="fade-in-up">
                    <div style={{ textAlign: "center", marginBottom: "40px" }}>
                        <div style={{ width: 72, height: 72, background: "var(--ink)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                            <Lightbulb style={{ width: 36, height: 36, color: "var(--paper)" }} />
                        </div>
                        <h1 style={{ fontFamily: "var(--bebas)", fontSize: "clamp(36px, 6vw, 48px)", letterSpacing: "0.02em", lineHeight: 1, marginBottom: "8px" }}>ADMIN PANEL</h1>
                        <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--muted)" }}>Secure Access Required</p>
                    </div>

                    <form onSubmit={handleLogin} className="glass-card" style={{ padding: "clamp(24px, 4vw, 40px)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Admin Email</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@dbit.in" className="input-field" required />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Password</label>
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input-field" required />
                            </div>
                        </div>
                        {loginError && (
                            <div style={{ padding: "12px 14px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", background: "rgba(232, 52, 26, 0.08)", color: "var(--red)", border: "1.5px solid var(--red)", marginBottom: "24px" }}>
                                {loginError}
                            </div>
                        )}
                        <button type="submit" disabled={loginLoading} className="btn-primary w-full" style={{ padding: "18px" }}>
                            {loginLoading ? <div className="spinner" /> : "Authorize & Enter"}
                        </button>
                    </form>
                </div>
            </main>
        );
    }

    // ─── Navigation items ───
    const navigationItems = [
        { id: "dashboard", label: "Overview", icon: <LayoutDashboard style={{ width: 22, height: 22 }} /> },
        { id: "students", label: "Students", icon: <Database style={{ width: 22, height: 22 }} /> },
        { id: "registrations", label: "Registrations", icon: <Users style={{ width: 22, height: 22 }} /> },
        { id: "teams", label: "Teams", icon: <Trophy style={{ width: 22, height: 22 }} /> },
        { id: "settings", label: "Settings", icon: <Settings style={{ width: 22, height: 22 }} /> }
    ];

    // ─── Main Panel ───
    return (
        <main className="admin-layout">

            {/* ── Sidebar (desktop + tablet icon-only) ── */}
            <aside className="admin-sidebar">
                <div className="admin-sidebar-header" style={{ padding: "24px", borderBottom: "1.5px solid var(--ink)", background: "var(--paper)", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Lightbulb style={{ width: 16, height: 16, color: "var(--paper)" }} />
                    </div>
                    <span className="admin-sidebar-logo-text" style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.04em" }}>IDEA LAB</span>
                </div>

                <div style={{ padding: "12px 8px", display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                    {navigationItems.map(item => (
                        <button
                            key={item.id}
                            className="admin-sidebar-nav-btn"
                            onClick={() => setActiveTab(item.id as TabType)}
                            title={item.label}
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "14px",
                                padding: "12px 16px",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                fontFamily: "var(--body)",
                                transition: "all 0.15s",
                                background: activeTab === item.id ? "var(--ink)" : "transparent",
                                color: activeTab === item.id ? "var(--paper)" : "var(--muted)",
                                borderLeft: activeTab === item.id ? "3px solid var(--red)" : "3px solid transparent",
                            }}
                        >
                            {item.icon}
                            <span className="admin-sidebar-label">{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="admin-sidebar-footer" style={{ padding: "16px", borderTop: "1.5px solid var(--ink)" }}>
                    <div className="admin-sidebar-user" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--paper)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: "10px", fontWeight: 700 }}>{user.email?.charAt(0).toUpperCase()}</span>
                        </div>
                        <p className="admin-sidebar-email" style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{user.email}</p>
                    </div>
                    <button
                        className="admin-sidebar-signout"
                        onClick={handleLogout}
                        title="Sign Out"
                        style={{
                            width: "100%", display: "flex", alignItems: "center", gap: "10px",
                            padding: "10px 14px", border: "1px solid var(--ink)", background: "transparent",
                            color: "var(--ink)", cursor: "pointer", fontSize: "10px", fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "var(--body)",
                            transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "var(--red)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink)"; e.currentTarget.style.borderColor = "var(--ink)"; }}
                    >
                        <LogOut style={{ width: 16, height: 16, flexShrink: 0 }} />
                        <span className="admin-sidebar-signout-text">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* ── Mobile Topbar ── */}
            <div className="admin-mobile-topbar">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Lightbulb style={{ width: 14, height: 14, color: "var(--paper)" }} />
                        </div>
                        <span style={{ fontFamily: "var(--bebas)", fontSize: "16px" }}>IDEA LAB</span>
                    </div>
                    <button onClick={handleLogout} style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--red)", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em" }}>Sign Out</button>
                </div>
                <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
                    {navigationItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as TabType)}
                            style={{
                                padding: "7px 14px",
                                whiteSpace: "nowrap",
                                fontSize: "10px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                border: "1px solid",
                                cursor: "pointer",
                                fontFamily: "var(--body)",
                                borderColor: activeTab === item.id ? "var(--ink)" : "var(--line)",
                                background: activeTab === item.id ? "var(--ink)" : "transparent",
                                color: activeTab === item.id ? "var(--paper)" : "var(--muted)",
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="admin-content">

                {dataLoading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                        <div style={{ textAlign: "center" }}>
                            <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 16px", borderColor: "var(--line)", borderTopColor: "var(--ink)" }} />
                            <p className="admin-section-sub">Loading Data...</p>
                        </div>
                    </div>
                ) : (
                    <div className="admin-inner fade-in-up">

                        {/* ── Dashboard Tab ── */}
                        {activeTab === "dashboard" && (
                            <>
                                <header>
                                    <h1 className="admin-section-title">OVERVIEW</h1>
                                    <p className="admin-section-sub">Real-time Event Metrics</p>
                                </header>

                                <AdminStats
                                    totalRegistrations={totalRegistrations}
                                    confirmedPairs={0}
                                    pendingRegistrations={0}
                                    teamsFormed={teamsForming + teamsFull}
                                    csvStudentCount={csvStudentCount}
                                    teamsForming={teamsForming}
                                    teamsFull={teamsFull}
                                />

                                <div className="admin-card">
                                    <h2 style={{ fontFamily: "var(--bebas)", fontSize: "clamp(20px, 3vw, 24px)", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                                        <LayoutDashboard style={{ width: 22, height: 22, color: "var(--red)" }} /> Branch Distribution
                                    </h2>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                        {Object.entries(branchStats).sort(([, a], [, b]) => b - a).map(([branch, count]) => (
                                            <div key={branch}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                                                    <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>{branch}</span>
                                                    <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>{count}</span>
                                                </div>
                                                <div style={{ height: "20px", border: "1.5px solid var(--ink)", background: "var(--paper2)", position: "relative" }}>
                                                    <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${(count / maxBranchCount) * 100}%`, background: branchColors[branch] || "var(--ink)", transition: "width 1s ease" }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Students Tab ── */}
                        {activeTab === "students" && (
                            <>
                                <header>
                                    <h1 className="admin-section-title">STUDENTS</h1>
                                    <p className="admin-section-sub">CSV Master Data — {csvStudentCount} Records</p>
                                </header>

                                <div className="admin-card">
                                    <h3 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.04em", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
                                        <Database style={{ width: 20, height: 20, color: "var(--red)" }} /> Upload Student CSV
                                    </h3>
                                    <CSVUploader onUploadComplete={fetchStudents} />
                                </div>

                                <div className="admin-card" style={{ padding: "4px" }}>
                                    <CSVStudentTable
                                        students={csvStudents}
                                        onUpdate={async (usn, data) => {
                                            const currentUser = auth.currentUser;
                                            if (!currentUser) throw new Error("Not authenticated");
                                            const idToken = await currentUser.getIdToken(true);
                                            const res = await fetch("/api/admin/students", {
                                                method: "PUT",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ idToken, usn, data }),
                                            });
                                            if (!res.ok) throw new Error("Update failed");
                                            setCsvStudents((prev) =>
                                                prev.map((s) => (s.usn === usn ? { ...s, ...data } : s))
                                            );
                                        }}
                                        onDelete={async (usn) => {
                                            const currentUser = auth.currentUser;
                                            if (!currentUser) throw new Error("Not authenticated");
                                            const idToken = await currentUser.getIdToken(true);
                                            const res = await fetch("/api/admin/students", {
                                                method: "DELETE",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ idToken, usn }),
                                            });
                                            if (!res.ok) throw new Error("Delete failed");
                                            setCsvStudents((prev) => prev.filter((s) => s.usn !== usn));
                                            setCsvStudentCount((c) => c - 1);
                                        }}
                                    />
                                </div>
                            </>
                        )}

                        {/* ── Registrations Tab ── */}
                        {activeTab === "registrations" && (
                            <>
                                <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}>
                                    <div>
                                        <h1 className="admin-section-title">REGISTRATIONS</h1>
                                        <p className="admin-section-sub">Full Participant Directory</p>
                                    </div>
                                    <button onClick={fetchStudents} className="btn-secondary" style={{ fontSize: "10px", fontWeight: 800, padding: "10px 24px" }}>
                                        RELOAD DATA
                                    </button>
                                </header>
                                <div className="admin-card" style={{ padding: "4px" }}>
                                    <StudentTable students={students} showTeamColumns={true} showLegacyColumns={true} teamNames={teamNamesMap} />
                                </div>
                            </>
                        )}

                        {/* ── Teams Tab ── */}
                        {activeTab === "teams" && (() => {
                            const grouped: Record<string, Student[]> = {};
                            const unteamed: Student[] = [];
                            students.forEach((s) => {
                                if (s.teamId) {
                                    if (!grouped[s.teamId]) grouped[s.teamId] = [];
                                    grouped[s.teamId].push(s);
                                } else {
                                    unteamed.push(s);
                                }
                            });
                            const teamIds = Object.keys(grouped).sort((a, b) => {
                                const nameA = teamNamesMap[a] || a;
                                const nameB = teamNamesMap[b] || b;
                                return nameA.localeCompare(nameB);
                            });

                            const buildExportRows = () => {
                                const rows: Record<string, string>[] = [];
                                teamIds.forEach((teamId) => {
                                    const members = grouped[teamId];
                                    const tName = teamNamesMap[teamId] || "";
                                    const tStatus = teamStatusMap[teamId] || "unknown";
                                    members.forEach((m) => {
                                        rows.push({
                                            "Team Name": tName,
                                            "Team Code": teamId,
                                            "Status": tStatus,
                                            "Role": m.teamRole || "",
                                            "Name": m.name,
                                            "USN": m.usn,
                                            "Email": m.email,
                                            "Phone": m.phone,
                                            "Branch": m.branch,
                                            "Section": m.section,
                                        });
                                    });
                                });
                                unteamed.forEach((s) => {
                                    rows.push({
                                        "Team Name": "",
                                        "Team Code": "",
                                        "Status": "No Team",
                                        "Role": "",
                                        "Name": s.name,
                                        "USN": s.usn,
                                        "Email": s.email,
                                        "Phone": s.phone,
                                        "Branch": s.branch,
                                        "Section": s.section,
                                    });
                                });
                                return rows;
                            };

                            const exportTeamsCSV = () => {
                                const rows = buildExportRows();
                                if (rows.length === 0) return;
                                const headers = Object.keys(rows[0]);
                                const csv = [
                                    headers.join(","),
                                    ...rows.map((r) => headers.map((h) => `"${(r[h] || "").replace(/"/g, '""')}"`).join(",")),
                                ].join("\n");
                                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                                const link = document.createElement("a");
                                link.href = URL.createObjectURL(blob);
                                link.download = `teams-export-${new Date().toISOString().split("T")[0]}.csv`;
                                link.click();
                                URL.revokeObjectURL(link.href);
                            };

                            const exportTeamsXLS = async () => {
                                try {
                                    const { exportSingleSheet } = await import("@/lib/xlsExport");
                                    exportSingleSheet(buildExportRows(), `teams-export-${new Date().toISOString().split("T")[0]}.xlsx`, "Teams");
                                } catch {
                                    exportTeamsCSV();
                                }
                            };

                            return (
                                <>
                                    <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}>
                                        <div>
                                            <h1 className="admin-section-title">TEAMS</h1>
                                            <p className="admin-section-sub">
                                                {teamIds.length} Teams — {teamsForming} Forming · {teamsFull} Full · {unteamed.length} Without Team
                                            </p>
                                        </div>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button onClick={exportTeamsCSV} className="btn-secondary" style={{ fontSize: "10px", fontWeight: 800, padding: "10px 16px", display: "flex", alignItems: "center", gap: "6px" }}>
                                                <Download style={{ width: 14, height: 14 }} /> CSV
                                            </button>
                                            <button onClick={exportTeamsXLS} className="btn-secondary" style={{ fontSize: "10px", fontWeight: 800, padding: "10px 16px", display: "flex", alignItems: "center", gap: "6px" }}>
                                                <FileSpreadsheet style={{ width: 14, height: 14 }} /> XLS
                                            </button>
                                        </div>
                                    </header>

                                    {teamIds.length === 0 ? (
                                        <div className="admin-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                                            <Trophy style={{ width: 40, height: 40, color: "var(--muted)", margin: "0 auto 16px" }} />
                                            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>No teams formed yet</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                            {teamIds.map((teamId) => {
                                                const members = grouped[teamId];
                                                const teamName = teamNamesMap[teamId] || "Unnamed Team";
                                                const status = teamStatusMap[teamId] || "unknown";
                                                const statusColor = status === "full" || status === "locked" ? "#10b981" : status === "forming" ? "#f59e0b" : "var(--muted)";

                                                return (
                                                    <div key={teamId} className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
                                                        {/* Team Header */}
                                                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "16px 20px", borderBottom: "1.5px solid var(--line)", background: "var(--paper2)" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                                <Trophy style={{ width: 18, height: 18, color: "var(--red)", flexShrink: 0 }} />
                                                                <div>
                                                                    <h3 style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.04em", lineHeight: 1 }}>{teamName}</h3>
                                                                    <p style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{teamId}</p>
                                                                </div>
                                                            </div>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                                <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", padding: "3px 10px", background: statusColor, color: "#fff" }}>
                                                                    {status}
                                                                </span>
                                                                <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
                                                                    {members.length} member{members.length !== 1 ? "s" : ""}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {/* Members */}
                                                        <div style={{ overflowX: "auto" }}>
                                                            <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                                                                <thead>
                                                                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                                                                        <th style={{ textAlign: "left", padding: "10px 20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "10px", color: "var(--muted)" }}>Name</th>
                                                                        <th style={{ textAlign: "left", padding: "10px 20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "10px", color: "var(--muted)" }}>USN</th>
                                                                        <th style={{ textAlign: "left", padding: "10px 20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "10px", color: "var(--muted)" }} className="admin-hide-mobile">Branch</th>
                                                                        <th style={{ textAlign: "left", padding: "10px 20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "10px", color: "var(--muted)" }}>Role</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {members.map((m, i) => (
                                                                        <tr key={m.usn} style={{ borderBottom: "1px solid var(--line)", background: i % 2 === 0 ? "transparent" : "var(--paper2)" }}>
                                                                            <td style={{ padding: "12px 20px", fontWeight: 600, color: "var(--ink)" }}>{m.name}</td>
                                                                            <td style={{ padding: "12px 20px", fontFamily: "monospace", fontSize: "12px", color: "var(--ink)" }}>{m.usn}</td>
                                                                            <td style={{ padding: "12px 20px", color: "var(--muted)" }} className="admin-hide-mobile">{m.branch}</td>
                                                                            <td style={{ padding: "12px 20px" }}>
                                                                                {m.teamRole ? (
                                                                                    <span className={`badge ${m.teamRole === "lead" ? "badge-danger" : "badge-success"}`}>
                                                                                        {m.teamRole}
                                                                                    </span>
                                                                                ) : "—"}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Unteamed Registrations */}
                                    {unteamed.length > 0 && (
                                        <div className="admin-card" style={{ padding: 0, overflow: "hidden", marginTop: "24px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderBottom: "1.5px solid var(--line)", background: "rgba(232, 52, 26, 0.04)" }}>
                                                <Users style={{ width: 18, height: 18, color: "var(--red)", flexShrink: 0 }} />
                                                <div>
                                                    <h3 style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.04em", lineHeight: 1 }}>WITHOUT TEAM</h3>
                                                    <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginTop: "2px" }}>
                                                        {unteamed.length} registered student{unteamed.length !== 1 ? "s" : ""} not in any team
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ overflowX: "auto" }}>
                                                <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: "1px solid var(--line)" }}>
                                                            <th style={{ textAlign: "left", padding: "10px 20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "10px", color: "var(--muted)" }}>Name</th>
                                                            <th style={{ textAlign: "left", padding: "10px 20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "10px", color: "var(--muted)" }}>USN</th>
                                                            <th style={{ textAlign: "left", padding: "10px 20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "10px", color: "var(--muted)" }} className="admin-hide-mobile">Branch</th>
                                                            <th style={{ textAlign: "left", padding: "10px 20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "10px", color: "var(--muted)" }} className="admin-hide-mobile">Section</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {unteamed.map((s, i) => (
                                                            <tr key={s.usn} style={{ borderBottom: "1px solid var(--line)", background: i % 2 === 0 ? "transparent" : "var(--paper2)" }}>
                                                                <td style={{ padding: "12px 20px", fontWeight: 600, color: "var(--ink)" }}>{s.name}</td>
                                                                <td style={{ padding: "12px 20px", fontFamily: "monospace", fontSize: "12px", color: "var(--ink)" }}>{s.usn}</td>
                                                                <td style={{ padding: "12px 20px", color: "var(--muted)" }} className="admin-hide-mobile">{s.branch}</td>
                                                                <td style={{ padding: "12px 20px", color: "var(--muted)" }} className="admin-hide-mobile">{s.section}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        {/* ── Settings Tab ── */}
                        {activeTab === "settings" && (
                            <>
                                <header>
                                    <h1 className="admin-section-title">SETTINGS</h1>
                                    <p className="admin-section-sub">Global Configurations</p>
                                </header>

                                <div className="admin-grid-2">
                                    {/* Registration Gate */}
                                    <div className="admin-card">
                                        <Settings style={{ width: 36, height: 36, color: "var(--muted)", marginBottom: "20px" }} />
                                        <h3 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.04em", marginBottom: "8px" }}>Registration Gate</h3>
                                        <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "32px", lineHeight: 1.8 }}>
                                            Portal is currently{" "}
                                            <span style={{ padding: "2px 8px", background: registrationsOpen ? "#10b981" : "var(--red)", color: "#fff" }}>
                                                {registrationsOpen ? "OPEN" : "LOCKED"}
                                            </span>
                                        </p>
                                        <button onClick={toggleRegistrations} disabled={configLoading} className="btn-primary w-full" style={{ padding: "14px" }}>
                                            {configLoading ? <div className="spinner" /> : (registrationsOpen ? "LOCK REGISTRATIONS" : "OPEN REGISTRATIONS")}
                                        </button>
                                    </div>

                                    {/* Team Formation Gate */}
                                    <div className="admin-card">
                                        <UsersRound style={{ width: 36, height: 36, color: "var(--muted)", marginBottom: "20px" }} />
                                        <h3 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.04em", marginBottom: "8px" }}>Team Formation</h3>
                                        <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "32px", lineHeight: 1.8 }}>
                                            Team creation is{" "}
                                            <span style={{ padding: "2px 8px", background: teamFormationOpen ? "#10b981" : "var(--red)", color: "#fff" }}>
                                                {teamFormationOpen ? "OPEN" : "LOCKED"}
                                            </span>
                                        </p>
                                        <button onClick={toggleTeamFormation} disabled={configLoading} className="btn-primary w-full" style={{ padding: "14px" }}>
                                            {configLoading ? <div className="spinner" /> : (teamFormationOpen ? "LOCK TEAM FORMATION" : "OPEN TEAM FORMATION")}
                                        </button>
                                    </div>

                                    {/* Danger Zone */}
                                    <div className="admin-card" style={{ borderColor: "var(--red)", gridColumn: "1 / -1" }}>
                                        <ShieldAlert style={{ width: 36, height: 36, color: "var(--red)", marginBottom: "20px" }} />
                                        <h3 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.04em", marginBottom: "8px", color: "var(--red)" }}>Danger Zone</h3>
                                        <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "32px", lineHeight: 1.8 }}>
                                            Wipe all registration, team, and invite data. Proceed with extreme caution.
                                        </p>
                                        <button
                                            onClick={() => setShowResetModal(true)}
                                            style={{
                                                width: "100%", padding: "14px", border: "1.5px solid var(--red)", background: "transparent",
                                                color: "var(--red)", cursor: "pointer", fontSize: "11px", fontWeight: 800,
                                                textTransform: "uppercase", letterSpacing: "0.16em", fontFamily: "var(--body)",
                                                transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.color = "#fff"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--red)"; }}
                                        >
                                            <Eraser style={{ width: 16, height: 16 }} /> RESET DATABASE
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Reset Modal ── */}
            {showResetModal && (
                <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(13,13,13,0.9)", backdropFilter: "blur(4px)" }}>
                    <div className="glass-card" style={{ maxWidth: "420px", width: "100%", padding: "clamp(24px, 4vw, 48px)", borderColor: "var(--red)" }}>
                        <div style={{ textAlign: "center", marginBottom: "32px" }}>
                            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                                <AlertTriangle style={{ width: 32, height: 32, color: "#fff" }} />
                            </div>
                            <h2 style={{ fontFamily: "var(--bebas)", fontSize: "clamp(28px, 4vw, 36px)", lineHeight: 1, marginBottom: "8px" }}>DANGER ZONE</h2>
                            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>
                                Permanently erase all <span style={{ color: "var(--red)" }}>data</span>.
                            </p>
                        </div>

                        <form onSubmit={handleResetDatabase} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            {/* Cleanup options */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px 16px", background: "rgba(232, 52, 26, 0.04)", border: "1.5px solid var(--line)" }}>
                                <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "4px" }}>
                                    Also Clear
                                </p>
                                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                                    <input
                                        type="checkbox"
                                        checked={clearOtpCodes}
                                        onChange={(e) => setClearOtpCodes(e.target.checked)}
                                        style={{ width: 16, height: 16, accentColor: "var(--red)" }}
                                    />
                                    OTP verification codes
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                                    <input
                                        type="checkbox"
                                        checked={clearCSV}
                                        onChange={(e) => setClearCSV(e.target.checked)}
                                        style={{ width: 16, height: 16, accentColor: "var(--red)" }}
                                    />
                                    CSV student master data
                                </label>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Admin Password</label>
                                <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="REQUIRED" className="input-field" required />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>
                                    Type <span style={{ color: "var(--red)", fontStyle: "italic" }}>RESET DATABASE</span>
                                </label>
                                <input type="text" value={resetPhrase} onChange={(e) => setResetPhrase(e.target.value)} placeholder="CONFIRMATION PHRASE" className="input-field" required />
                            </div>

                            {resetError && (
                                <div style={{ padding: "12px 14px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", background: "var(--red)", color: "#fff", border: "1px solid var(--ink)" }}>
                                    {resetError}
                                </div>
                            )}

                            <div style={{ display: "flex", gap: "12px" }}>
                                <button
                                    type="button"
                                    onClick={() => { setShowResetModal(false); setResetError(""); setResetPassword(""); setResetPhrase(""); }}
                                    className="btn-secondary"
                                    style={{ flex: 1, padding: "14px" }}
                                >
                                    ABORT
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetLoading || resetPhrase !== "RESET DATABASE" || !resetPassword}
                                    style={{
                                        flex: 1, padding: "14px", background: "var(--red)", color: "#fff",
                                        fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em",
                                        fontSize: "11px", border: "1px solid var(--ink)", cursor: "pointer",
                                        opacity: (resetLoading || resetPhrase !== "reset database" || !resetPassword) ? 0.3 : 1,
                                        transition: "all 0.15s", fontFamily: "var(--body)",
                                    }}
                                >
                                    {resetLoading ? <div className="spinner" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> : "ERASE DATA"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}

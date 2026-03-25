"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import {
  getAllHR,
  createHR,
  updateHR,
  blockHR,
  activateHR,
  deleteHR,
} from "../../../lib/api";
import LoadingSpinner from "../../../components/loading-spinner";
import PasswordField from "../../../components/password-field";
import PasswordStrengthHint from "../../../components/password-strength-hint";
import BrandLogo from "../../../components/BrandLogo";

export default function AdminHRManagementPage() {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [hrAccounts, setHrAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true); // Default to dark mode like the image
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMenuItems, setShowMenuItems] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingHR, setEditingHR] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");

  // Calculate statistics
  const totalHR = hrAccounts.length;
  const activeHR = hrAccounts.filter(hr => !hr.disabled).length;
  const blockedHR = hrAccounts.filter(hr => hr.disabled).length;

  // Load dark mode preference from localStorage on mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
  }, []);

  // Save dark mode preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  // Check admin authentication
  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    const adminData = localStorage.getItem("admin");

    if (!token || !adminData) {
      toast.error("Please login as admin first", { position: "top-right" });
      router.push("/admin/login");
      return;
    }

    setAdminToken(token);
    setAdmin(JSON.parse(adminData));
    loadHRAccounts(token);

    // Close dropdowns when clicking outside
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.relative')) {
        setShowDropdown(false);
      }
      if (showNotificationDropdown && !event.target.closest('.relative')) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [router, showDropdown, showNotificationDropdown]);

  const loadHRAccounts = async (token) => {
    try {
      setLoading(true);
      const result = await getAllHR(token);

      if (result.success) {
        setHrAccounts(result.data.hrAccounts || []);
      } else {
        toast.error(result.error || "Failed to load HR accounts", { position: "top-right" });
      }
    } catch (error) {
      console.error("Error loading HR accounts:", error);
      toast.error("An error occurred while loading HR accounts", { position: "top-right" });
    } finally {
      setLoading(false);
    }
  };

  const onCreateSubmit = async (data) => {
    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match", { position: "top-right" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createHR(
        {
          name: data.name,
          email: data.email,
          password: data.password,
        },
        adminToken
      );

      if (result.success) {
        toast.success("HR account created successfully!", { position: "top-right" });
        setShowCreateModal(false);
        reset();
        loadHRAccounts(adminToken);
      } else {
        toast.error(result.error || "Failed to create HR account", { position: "top-right" });
      }
    } catch (error) {
      console.error("Error creating HR:", error);
      toast.error("An error occurred. Please try again.", { position: "top-right" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const result = await updateHR(
        editingHR.uid,
        {
          name: data.name,
          email: data.email,
        },
        adminToken
      );

      if (result.success) {
        toast.success("HR account updated successfully!", { position: "top-right" });
        setEditingHR(null);
        reset();
        loadHRAccounts(adminToken);
      } else {
        toast.error(result.error || "Failed to update HR account", { position: "top-right" });
      }
    } catch (error) {
      console.error("Error updating HR:", error);
      toast.error("An error occurred. Please try again.", { position: "top-right" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlock = async (uid) => {
    if (!confirm("Are you sure you want to block this HR account?")) return;

    try {
      const result = await blockHR(uid, adminToken);

      if (result.success) {
        toast.success("HR account blocked successfully!", { position: "top-right" });
        loadHRAccounts(adminToken);
      } else {
        toast.error(result.error || "Failed to block HR account", { position: "top-right" });
      }
    } catch (error) {
      console.error("Error blocking HR:", error);
      toast.error("An error occurred. Please try again.", { position: "top-right" });
    }
  };

  const handleActivate = async (uid) => {
    if (!confirm("Are you sure you want to activate this HR account?")) return;

    try {
      const result = await activateHR(uid, adminToken);

      if (result.success) {
        toast.success("HR account activated successfully!", { position: "top-right" });
        loadHRAccounts(adminToken);
      } else {
        toast.error(result.error || "Failed to activate HR account", { position: "top-right" });
      }
    } catch (error) {
      console.error("Error activating HR:", error);
      toast.error("An error occurred. Please try again.", { position: "top-right" });
    }
  };

  const handleDelete = async (uid) => {
    if (!confirm("Are you sure you want to delete this HR account? This action cannot be undone.")) return;

    try {
      const result = await deleteHR(uid, adminToken);

      if (result.success) {
        toast.success("HR account deleted successfully!", { position: "top-right" });
        loadHRAccounts(adminToken);
      } else {
        toast.error(result.error || "Failed to delete HR account", { position: "top-right" });
      }
    } catch (error) {
      console.error("Error deleting HR:", error);
      toast.error("An error occurred. Please try again.", { position: "top-right" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
    toast.success("Logged out successfully", { autoClose: 2000 });
    router.push("/admin/login");
  };

  const openEditModal = (hr) => {
    setEditingHR(hr);
    reset({
      name: hr.name,
      email: hr.email,
      password: "",
      confirmPassword: "",
    });
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setEditingHR(null);
    reset();
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-white via-fuchsia-50/40 to-violet-50'}`}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-white via-fuchsia-50/30 to-violet-50/40'}`}>
      <style>{`
        body {
          background: ${darkMode ? '#111827' : '#f9fafb'};
          min-height: 100vh;
        }
      `}</style>

      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg flex flex-col transition-all duration-300 overflow-hidden`}
      >
        {/* Logo */}
        <div className={`${sidebarCollapsed ? 'p-3' : 'p-6'} border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} relative`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-3`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 flex-1 min-w-0 py-1">
                <BrandLogo className={`h-16 w-auto max-h-[4.25rem] shrink-0 ${darkMode ? 'brightness-110' : ''}`} />
              </div>
            )}
            {sidebarCollapsed && (
              <div className="flex justify-center w-full py-1">
                <BrandLogo className={`h-12 w-auto max-h-14 shrink-0 ${darkMode ? 'brightness-110' : ''}`} />
              </div>
            )}
            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`flex-shrink-0 p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg transition-colors hidden lg:flex ${sidebarCollapsed ? 'absolute top-2 right-2' : ''}`}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Menu */}
        <div className={`flex-1 p-4 overflow-y-auto ${sidebarCollapsed ? 'p-2' : ''}`}>
          {!sidebarCollapsed && (
            <div className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mb-4 px-3`}>MAIN MENU</div>
          )}
          
          <div className="space-y-1">
            <button
              onClick={() => {
                setShowMenuItems(!showMenuItems);
                setShowSidebar(false);
              }}
              className={`w-full ${darkMode ? 'bg-purple-900/30' : 'bg-purple-50'} rounded-lg ${sidebarCollapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2.5'} flex items-center gap-3 cursor-pointer`}
              title={sidebarCollapsed ? 'Dashboard' : ''}
            >
              <svg className={`w-5 h-5 flex-shrink-0 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {!sidebarCollapsed && (
                <>
                  <span className={`text-sm font-medium ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>Dashboard</span>
                  <svg className={`w-4 h-4 ${darkMode ? 'text-purple-400' : 'text-purple-600'} ml-auto transition-transform ${showMenuItems ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              )}
            </button>

            {showMenuItems && !sidebarCollapsed && (
              <>
                <div className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mt-4 mb-2 px-3`}>OPTIONS</div>
                
                <button
                  onClick={() => {
                    router.push("/admin/hr");
                    setShowSidebar(false);
                  }}
                  className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg px-3 py-2.5 flex items-center gap-3 cursor-pointer`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Analytics</span>
                </button>

                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    setShowSidebar(false);
                  }}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Create HR Account</span>
                </button>

                <button
                  onClick={() => {
                    // Scroll to HR accounts table
                    document.getElementById('hr-accounts-table')?.scrollIntoView({ behavior: 'smooth' });
                    setShowSidebar(false);
                  }}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>View All HR Accounts</span>
                </button>
              </>
            )}
            
            {/* Collapsed menu items */}
            {sidebarCollapsed && showMenuItems && (
              <div className="space-y-2 mt-4">
                <button
                  onClick={() => router.push("/admin/hr")}
                  className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-2 flex items-center justify-center cursor-pointer`}
                  title="Analytics"
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg p-2 flex items-center justify-center cursor-pointer transition-colors`}
                  title="Create HR Account"
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={() => document.getElementById('hr-accounts-table')?.scrollIntoView({ behavior: 'smooth' })}
                  className={`w-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} rounded-lg p-2 flex items-center justify-center cursor-pointer transition-colors`}
                  title="View All HR Accounts"
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Avatar */}
        <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className={`${sidebarCollapsed ? 'justify-center' : ''} flex items-center gap-3`}>
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-gray-800'}`}>Admin</div>
                <div className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{admin?.email || 'admin@neurohire.com'}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} px-4 sm:px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={`lg:hidden p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg`}
              >
                <svg className={`w-6 h-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex-1 text-center lg:text-left">
                <h1 className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Dashboard</h1>
                <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>NeuroHire where hiring meets AI</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Theme Toggle */}
              <div className={`flex items-center gap-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-1`}>
                <button
                  onClick={() => setDarkMode(false)}
                  className={`p-2 rounded transition-colors ${!darkMode ? 'bg-white shadow-sm' : darkMode ? 'hover:bg-gray-600' : ''}`}
                  title="Light mode"
                >
                  <svg className={`w-4 h-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDarkMode(true)}
                  className={`p-2 rounded transition-colors ${darkMode ? 'bg-gray-600 shadow-sm' : ''}`}
                  title="Dark mode"
                >
                  <svg className={`w-4 h-4 ${darkMode ? 'text-white' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </button>
              </div>

              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg relative transition-colors`}
                >
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
                
                {/* Notification Dropdown */}
                {showNotificationDropdown && (
                  <div className={`absolute right-0 mt-2 w-80 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl border ${darkMode ? 'border-gray-700' : 'border-gray-200'} z-50`}>
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Notifications</h3>
                    </div>
                    <div className={`px-4 py-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>No new notifications</p>
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile with Dropdown */}
              <div className="relative">
                <div 
                  className={`flex items-center gap-2 cursor-pointer ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg px-2 sm:px-3 py-2 transition-colors`}
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">AD</span>
                  </div>
                  <span className={`hidden sm:inline text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    {admin?.email || "Admin"}
                  </span>
                  <svg className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {/* Dropdown Menu */}
                {showDropdown && (
                  <div className={`absolute right-0 mt-2 w-48 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'} z-50`}>
                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className={`w-full text-left px-4 py-2 text-sm ${darkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} transition-colors flex items-center gap-2`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className={`flex-1 p-4 sm:p-6 overflow-y-auto ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            {/* Total HR */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-fuchsia-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-fuchsia-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>
                {totalHR}
              </div>
              <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Total HR Accounts</div>
            </div>

            {/* Active HR */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>
                {activeHR}
              </div>
              <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Active HR Accounts</div>
            </div>

            {/* Blocked HR */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>
                {blockedHR}
              </div>
              <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>Blocked HR Accounts</div>
            </div>

            {/* New This Month */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>
                {hrAccounts.filter(hr => {
                  const createdDate = new Date(hr.createdAt);
                  const now = new Date();
                  return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
                }).length}
              </div>
              <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>New This Month</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
            {/* HR Status Distribution */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
                <h3 className={`text-base sm:text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>HR Account Overview</h3>
              </div>
              <div className="h-48 sm:h-64 overflow-x-auto">
                <svg width="100%" height="100%" viewBox="0 0 600 200" preserveAspectRatio="none">
                  {(() => {
                    const data = [
                      { month: 'Active', value: activeHR },
                      { month: 'Blocked', value: blockedHR },
                    ];
                    const maxValue = Math.max(totalHR, 1);
                    
                    return (
                      <>
                        {/* Y-axis labels */}
                        {[0, Math.ceil(maxValue * 0.5), maxValue].map((val, idx) => (
                          <text key={`y-${idx}`} x="10" y={200 - (val / maxValue) * 180} className={`text-xs ${darkMode ? 'fill-gray-400' : 'fill-gray-500'}`}>
                            {val}
                          </text>
                        ))}
                        
                        {/* Grid lines */}
                        {[0, Math.ceil(maxValue * 0.5), maxValue].map((val, idx) => (
                          <line
                            key={`grid-${idx}`}
                            x1="40"
                            y1={200 - (val / maxValue) * 180}
                            x2="580"
                            y2={200 - (val / maxValue) * 180}
                            stroke={darkMode ? "#374151" : "#e5e7eb"}
                            strokeWidth="1"
                          />
                        ))}

                        {/* Line chart */}
                        <polyline
                          points={data.map((d, i) => {
                            const x = data.length > 1 ? 40 + (i / (data.length - 1)) * 540 : 290;
                            const y = 200 - (d.value / maxValue) * 180;
                            return `${x},${y}`;
                          }).join(" ")}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                        />

                        {/* Data points */}
                        {data.map((d, i) => {
                          const x = data.length > 1 ? 40 + (i / (data.length - 1)) * 540 : 290;
                          return (
                            <g key={`point-${i}`}>
                              <circle cx={x} cy={200 - (d.value / maxValue) * 180} r="6" fill="#10b981" />
                              <text x={x} y={200 - (d.value / maxValue) * 180 - 12} className={`text-xs font-semibold ${darkMode ? 'fill-white' : 'fill-gray-800'}`} textAnchor="middle">
                                {d.value}
                              </text>
                            </g>
                          );
                        })}

                        {/* X-axis labels */}
                        {data.map((d, i) => {
                          const x = data.length > 1 ? 40 + (i / (data.length - 1)) * 540 : 290;
                          return (
                            <text key={`x-${i}`} x={x} y="195" className={`text-xs ${darkMode ? 'fill-gray-400' : 'fill-gray-500'}`} textAnchor="middle">
                              {d.month}
                            </text>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* HR Status Bar Chart */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-base sm:text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>HR Status Distribution</h3>
              </div>
              <div className="h-48 sm:h-64 overflow-x-auto">
                <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
                  {(() => {
                    const maxValue = Math.max(activeHR, blockedHR, 1);
                    const barWidth = 80;
                    const spacing = 100;
                    const startX = 80;
                    
                    return (
                      <>
                        {/* Y-axis labels */}
                        {[0, Math.ceil(maxValue * 0.5), maxValue].map((val, idx) => (
                          <text key={`bar-y-${idx}`} x="10" y={200 - (val / maxValue) * 180} className={`text-xs ${darkMode ? 'fill-gray-400' : 'fill-gray-500'}`}>
                            {val}
                          </text>
                        ))}
                        
                        {/* Grid lines */}
                        {[0, Math.ceil(maxValue * 0.5), maxValue].map((val, idx) => (
                          <line
                            key={`bar-grid-${idx}`}
                            x1="40"
                            y1={200 - (val / maxValue) * 180}
                            x2="380"
                            y2={200 - (val / maxValue) * 180}
                            stroke={darkMode ? "#374151" : "#e5e7eb"}
                            strokeWidth="1"
                          />
                        ))}

                        {/* Active HR Bar */}
                        <g>
                          <rect
                            x={startX}
                            y={200 - (activeHR / maxValue) * 180}
                            width={barWidth}
                            height={(activeHR / maxValue) * 180}
                            fill="#10b981"
                            rx="4"
                          />
                          <text x={startX + barWidth / 2} y="195" className={`text-xs ${darkMode ? 'fill-gray-400' : 'fill-gray-500'}`} textAnchor="middle">
                            Active
                          </text>
                          <text x={startX + barWidth / 2} y={195 - (activeHR / maxValue) * 180} className={`text-xs font-semibold ${darkMode ? 'fill-white' : 'fill-gray-800'}`} textAnchor="middle">
                            {activeHR}
                          </text>
                        </g>

                        {/* Blocked HR Bar */}
                        <g>
                          <rect
                            x={startX + spacing}
                            y={200 - (blockedHR / maxValue) * 180}
                            width={barWidth}
                            height={(blockedHR / maxValue) * 180}
                            fill="#f59e0b"
                            rx="4"
                          />
                          <text x={startX + spacing + barWidth / 2} y="195" className={`text-xs ${darkMode ? 'fill-gray-400' : 'fill-gray-500'}`} textAnchor="middle">
                            Blocked
                          </text>
                          <text x={startX + spacing + barWidth / 2} y={195 - (blockedHR / maxValue) * 180} className={`text-xs font-semibold ${darkMode ? 'fill-white' : 'fill-gray-800'}`} textAnchor="middle">
                            {blockedHR}
                          </text>
                        </g>
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          </div>

          {/* HR Accounts Table */}
          <div id="hr-accounts-table" className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-100'} overflow-hidden`}>
            <div className={`px-4 sm:px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3`}>
              <h3 className={`text-base sm:text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>HR Accounts</h3>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg transition-colors font-medium text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create HR Account
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Name
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Email
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Status
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Created
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Last Sign In
                    </th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`${darkMode ? 'bg-gray-800' : 'bg-white'} divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {hrAccounts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className={`px-6 py-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        No HR accounts found. Create one to get started.
                      </td>
                    </tr>
                  ) : (
                    hrAccounts.map((hr) => (
                      <tr key={hr.uid} className={`${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}>
                        <td className={`px-6 py-4 whitespace-nowrap`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{hr.name?.charAt(0)?.toUpperCase() || 'H'}</span>
                            </div>
                            <div className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{hr.name}</div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap`}>
                          <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>{hr.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              hr.disabled
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            }`}
                          >
                            {hr.disabled ? "Blocked" : "Active"}
                          </span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                          {hr.createdAt ? new Date(hr.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                          {hr.lastSignIn ? new Date(hr.lastSignIn).toLocaleDateString() : "Never"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(hr)}
                              className={`${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-900'} transition-colors`}
                            >
                              Edit
                            </button>
                            {hr.disabled ? (
                              <button
                                onClick={() => handleActivate(hr.uid)}
                                className={`${darkMode ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-900'} transition-colors`}
                              >
                                Activate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBlock(hr.uid)}
                                className={`${darkMode ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-900'} transition-colors`}
                              >
                                Block
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(hr.uid)}
                              className={`${darkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-900'} transition-colors`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Create HR Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Create HR Account</h2>
              <button
                onClick={closeModals}
                className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg transition-colors`}
              >
                <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Name</label>
                <input
                  type="text"
                  {...register("name", { required: "Name is required" })}
                  className={`w-full px-4 py-2.5 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent`}
                  placeholder="Enter HR name"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
                <input
                  type="email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Invalid email format",
                    },
                  })}
                  className={`w-full px-4 py-2.5 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent`}
                  placeholder="Enter email address"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <PasswordField
                label="Password"
                id="password"
                placeholder="Enter password"
                register={register}
                errors={errors}
                fieldName="password"
                required="Password is required"
                darkMode={darkMode}
              />

              <PasswordField
                label="Confirm Password"
                id="confirmPassword"
                placeholder="Confirm password"
                register={register}
                errors={errors}
                fieldName="confirmPassword"
                required="Please confirm your password"
                darkMode={darkMode}
              />

              <PasswordStrengthHint password={password} />

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModals}
                  className={`flex-1 px-4 py-2.5 border rounded-lg transition-colors font-medium ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 disabled:bg-fuchsia-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isSubmitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit HR Modal */}
      {editingHR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Edit HR Account</h2>
              <button
                onClick={closeModals}
                className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg transition-colors`}
              >
                <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Name</label>
                <input
                  type="text"
                  {...register("name", { required: "Name is required" })}
                  className={`w-full px-4 py-2.5 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent`}
                  placeholder="Enter HR name"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
                <input
                  type="email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Invalid email format",
                    },
                  })}
                  className={`w-full px-4 py-2.5 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent`}
                  placeholder="Enter email address"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModals}
                  className={`flex-1 px-4 py-2.5 border rounded-lg transition-colors font-medium ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 disabled:bg-fuchsia-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isSubmitting ? "Updating..." : "Update Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

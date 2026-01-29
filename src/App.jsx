import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CampProvider } from './context/CampContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DataEntry from './pages/DataEntry';
import FamiliesList from './pages/FamiliesList';
import EditFamily from './pages/EditFamily';
import AidDelivery from './pages/AidDelivery';
import AidImport from './pages/AidImport';
import Search from './pages/Search';
import CustomReport from './pages/CustomReport';
import FamilyProfile from './pages/FamilyProfile';
import PrintFamilies from './pages/PrintFamilies';
import Notifications from './pages/Notifications';
import SettingsPage from './pages/SettingsPage';
import BackupRestore from './pages/BackupRestore';
import CardsPage from './pages/CardsPage';
import OfflineEntry from './pages/OfflineEntry'; // Import
import GuestCheck from './pages/GuestCheck';
import SmartReport from './pages/SmartReport';
import Layout from './components/layout/Layout';

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;
    if (!user) return <Navigate to="/login" />;
    return children;
};

function App() {
    return (
        <AuthProvider>
            <CampProvider>
                <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/check" element={<GuestCheck />} />
                        <Route path="/" element={
                            <ProtectedRoute>
                                <Layout>
                                    <Dashboard />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/entry" element={
                            <ProtectedRoute>
                                <Layout>
                                    <DataEntry />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/families" element={
                            <ProtectedRoute>
                                <Layout>
                                    <FamiliesList />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/family-profile" element={
                            <ProtectedRoute>
                                <Layout>
                                    <FamilyProfile />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/edit/:familyId" element={
                            <ProtectedRoute>
                                <Layout>
                                    <EditFamily />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/aid/:familyId" element={
                            <ProtectedRoute>
                                <Layout>
                                    <AidDelivery />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/aid-import" element={
                            <ProtectedRoute>
                                <Layout>
                                    <AidImport />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/search" element={
                            <ProtectedRoute>
                                <Layout>
                                    <Search />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/custom-report" element={
                            <ProtectedRoute>
                                <Layout>
                                    <CustomReport />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/smart-report" element={
                            <ProtectedRoute>
                                <Layout>
                                    <SmartReport />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/notifications" element={
                            <ProtectedRoute>
                                <Layout>
                                    <Notifications />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/settings" element={
                            <ProtectedRoute>
                                <Layout>
                                    <SettingsPage />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/backup" element={
                            <ProtectedRoute>
                                <Layout>
                                    <BackupRestore />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/cards" element={
                            <ProtectedRoute>
                                <CardsPage />
                            </ProtectedRoute>
                        } />
                        <Route path="/print-cards" element={
                            <ProtectedRoute>
                                <PrintFamilies />
                            </ProtectedRoute>
                        } />
                        <Route path="/offline" element={
                            <ProtectedRoute>
                                <Layout>
                                    <OfflineEntry />
                                </Layout>
                            </ProtectedRoute>
                        } />
                    </Routes>
                </Router>
            </CampProvider>
        </AuthProvider>
    );
}

export default App;

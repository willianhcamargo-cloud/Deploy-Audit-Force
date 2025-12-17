
import React, { useState, useCallback } from 'react';
import { useMockData } from './hooks/useMockData';
import type { User, Audit, AuditGrid, ActionPlan, Finding, AuditStatus, Policy, Meeting, PerformanceIndicator, TaskStatus, UserSubmitData, PolicySubmitData } from './types';

import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { AuditList } from './components/AuditList';
import { AuditDetails } from './components/AuditDetails';
import { UserManagement } from './components/UserManagement';
import { GridManagement } from './components/GridManagement';
import { CreateUserModal } from './components/CreateUserModal';
import { CreateAuditModal } from './components/CreateAuditModal';
import { CreateGridModal } from './components/CreateGridModal';
import { generateRecommendation } from './services/geminiService';
import { generateICSFile } from './services/calendarService';
import { CreateActionPlanModal } from './components/CreateActionPlanModal';
import { Sidebar } from './components/Sidebar';
import { Chatbot } from './components/Chatbot';
import { ReportModal } from './components/ReportModal';
import { Toast } from './components/Toast';
import { PolicyManagement } from './components/PolicyManagement';
import { CreatePolicyModal } from './components/CreatePolicyModal';
import { ViewPolicyModal } from './components/ViewPolicyModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { CreateMeetingModal } from './components/CreateMeetingModal';
import { MeetingConfirmationModal } from './components/MeetingConfirmationModal';
import { VersionConfirmationModal } from './components/VersionConfirmationModal';


type Page = 'dashboard' | 'audits' | 'grids' | 'users' | 'chatbot' | 'policies';

interface ToastMessage {
    id: number;
    message: string;
    type: 'success' | 'error';
}

// FIX: Export 'App' as a named component to align with project conventions and fix import errors.
export const App: React.FC = () => {
    const mockData = useMockData();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

    // Modal States
    const [isCreateUserModalOpen, setCreateUserModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [isCreateAuditModalOpen, setCreateAuditModalOpen] = useState(false);
    const [isCreateGridModalOpen, setCreateGridModalOpen] = useState(false);
    const [gridToEdit, setGridToEdit] = useState<AuditGrid | null>(null);
    const [isCreateActionPlanModalOpen, setCreateActionPlanModalOpen] = useState(false);
    const [actionPlanToEdit, setActionPlanToEdit] = useState<ActionPlan | null>(null);
    const [currentFindingIdForActionPlan, setCurrentFindingIdForActionPlan] = useState<string | null>(null);
    const [currentIndicatorIdForActionPlan, setCurrentIndicatorIdForActionPlan] = useState<string | null>(null);
    const [isCreatePolicyModalOpen, setCreatePolicyModalOpen] = useState(false);
    const [policyToEdit, setPolicyToEdit] = useState<Policy | null>(null);
    const [policyToView, setPolicyToView] = useState<Policy | null>(null);
    const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);
    const [isCreateMeetingModalOpen, setCreateMeetingModalOpen] = useState(false);
    const [meetingToEdit, setMeetingToEdit] = useState<Meeting | null>(null);
    const [defaultMeetingDate, setDefaultMeetingDate] = useState<string | null>(null);
    const [invitationDetails, setInvitationDetails] = useState<{ content: string; filename: string; mailtoUrl: string } | null>(null);
    const [meetingToCancel, setMeetingToCancel] = useState<Meeting | null>(null);
    const [versionConfirmState, setVersionConfirmState] = useState<{ policyData: PolicySubmitData, isOpen: boolean } | null>(null);
    const [reportData, setReportData] = useState<{
        audit: Audit;
        grid: AuditGrid;
        auditor?: User;
        actionPlans: ActionPlan[];
        users: User[];
    } | null>(null);
    
    // AI State
    const [aiRecommendation, setAiRecommendation] = useState('');
    const [isGeneratingAIRecommendation, setIsGeneratingAIRecommendation] = useState(false);

    // Toast State
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = (message: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, 5000);
    };

    const handleLogin = (email: string, password?: string): boolean => {
        const lowerCaseEmail = email.toLowerCase();
        let user: User | undefined;

        // Special case for passwordless admin login
        if (lowerCaseEmail === 'willianhcamargo@gmail.com') {
            user = mockData.users.find(u => u.email.toLowerCase() === lowerCaseEmail && u.role === 'Administrator');
        } else {
            // Standard login for all other users
            user = mockData.users.find(u => u.email.toLowerCase() === lowerCaseEmail && u.password === password);
        }
        
        if (user) {
            const userWithOnlineStatus: User = { ...user, status: 'Online' };
            mockData.updateUser(userWithOnlineStatus);
            setCurrentUser(userWithOnlineStatus);
            return true;
        }

        return false;
    };

    const handleLogout = () => {
        if (currentUser) {
            mockData.updateUser({ ...currentUser, status: 'Offline' });
        }
        setCurrentUser(null);
        setCurrentPage('dashboard');
        setSelectedAuditId(null);
    };

    const handleNavigate = (page: Page) => {
        setSelectedAuditId(null);
        setCurrentPage(page);
    };

    const handleSelectAudit = (auditId: string) => {
        setSelectedAuditId(auditId);
    };

    const handleBackToAudits = () => {
        setSelectedAuditId(null);
    };

    const handleSaveUser = (userData: UserSubmitData) => {
        const { avatarFile, ...restUserData } = userData;
        const lowerCaseEmail = ('email' in restUserData ? restUserData.email : '').toLowerCase();

        // Editing User
        if ('id' in restUserData) {
            const otherUsers = mockData.users.filter(u => u.id !== restUserData.id);
            if (otherUsers.some(u => u.email.toLowerCase() === lowerCaseEmail)) {
                addToast(`O e-mail ${restUserData.email} já está em uso por outro usuário.`, 'error');
                return;
            }
            
            const userToUpdate = mockData.users.find(u => u.id === restUserData.id);
            
            // FIX: Add a safeguard to prevent a crash if the user to be edited is not found.
            if (!userToUpdate) {
                addToast(`Erro: Usuário com ID ${restUserData.id} não encontrado.`, 'error');
                return;
            }

            const updatedUser: User = {
                ...userToUpdate,
                ...restUserData,
                avatarUrl: avatarFile ? URL.createObjectURL(avatarFile) : userToUpdate.avatarUrl,
            };
            mockData.updateUser(updatedUser);
            addToast(`Usuário ${restUserData.name} atualizado com sucesso.`);
        
        // Creating User
        } else {
             if (mockData.users.some(u => u.email.toLowerCase() === lowerCaseEmail)) {
                addToast(`O e-mail ${restUserData.email} já está em uso.`, 'error');
                return;
            }
            
            const userToCreate = {
                ...restUserData,
                avatarUrl: avatarFile ? URL.createObjectURL(avatarFile) : undefined,
            };
            mockData.addUser(userToCreate);
            addToast(`Um e-mail de boas-vindas foi enviado para ${restUserData.email}.`);
        }

        setCreateUserModalOpen(false);
        setUserToEdit(null);
    };
    
    const handleOpenEditUserModal = (userId: string) => {
        const user = mockData.users.find(u => u.id === userId);
        if (user) {
            setUserToEdit(user);
            setCreateUserModalOpen(true);
        }
    };
    
    const handleOpenCreateUserModal = () => {
        setUserToEdit(null);
        setCreateUserModalOpen(true);
    };

     const handleUpdateCurrentUserAvatar = (file: File) => {
        if (currentUser) {
            const newAvatarUrl = URL.createObjectURL(file);
            const updatedUser = { ...currentUser, avatarUrl: newAvatarUrl };
            mockData.updateUser(updatedUser);
            setCurrentUser(updatedUser); // Update state for immediate reflection
            addToast('Foto de perfil atualizada com sucesso!');
        }
    };

    const handleSaveAudit = (auditData: Omit<Audit, 'id' | 'findings' | 'status' | 'code'>) => {
        mockData.addAudit(auditData);
        setCreateAuditModalOpen(false);
        const auditorName = mockData.users.find(u => u.id === auditData.auditorId)?.name || 'O auditor';
        addToast(`Auditoria agendada. ${auditorName} será notificado por e-mail.`);
    };
    
    const handleSaveGrid = (gridData: AuditGrid | Omit<AuditGrid, 'id'>) => {
        mockData.saveGrid(gridData);
        setCreateGridModalOpen(false);
        setGridToEdit(null);
    };

    const handleEditGrid = (gridId: string) => {
        const grid = mockData.grids.find(g => g.id === gridId);
        if(grid) {
            setGridToEdit(grid);
            setCreateGridModalOpen(true);
        }
    }

    const handleGetAIAssistance = async (findingDescription: string) => {
        if (!findingDescription) {
            setAiRecommendation('Por favor, adicione uma descrição do achado para obter uma recomendação da IA.');
            return;
        }
        setIsGeneratingAIRecommendation(true);
        setAiRecommendation('');
        try {
            const recommendation = await generateRecommendation(findingDescription);
            setAiRecommendation(recommendation);
        } catch (error) {
            console.error(error);
            setAiRecommendation('Houve um erro ao gerar a recomendação. Tente novamente.');
        } finally {
            setIsGeneratingAIRecommendation(false);
        }
    };

    const handleSaveActionPlan = (planData: Omit<ActionPlan, 'id' | 'followUps'> | ActionPlan) => {
        mockData.saveActionPlan(planData);
        setCreateActionPlanModalOpen(false);
        setActionPlanToEdit(null);
        const responsibleUser = mockData.users.find(u => u.id === planData.who);
        addToast(`Plano de ação atribuído a ${responsibleUser?.name || 'usuário'}.`);
    };
    
    const handleOpenCreateActionPlanModal = (context: { findingId?: string, indicatorId?: string }) => {
        if (context.findingId) {
            setCurrentFindingIdForActionPlan(context.findingId);
            setCurrentIndicatorIdForActionPlan(null);
        } else if (context.indicatorId) {
            setCurrentFindingIdForActionPlan(null);
            setCurrentIndicatorIdForActionPlan(context.indicatorId);
        }
        setActionPlanToEdit(null);
        setCreateActionPlanModalOpen(true);
    };

    const handleOpenEditActionPlanModal = (plan: ActionPlan) => {
        setActionPlanToEdit(plan);
        if (plan.findingId) {
            setCurrentFindingIdForActionPlan(plan.findingId);
            setCurrentIndicatorIdForActionPlan(null);
        } else if (plan.performanceIndicatorId) {
            setCurrentFindingIdForActionPlan(null);
            setCurrentIndicatorIdForActionPlan(plan.performanceIndicatorId);
        }
        setCreateActionPlanModalOpen(true);
    };
    
    const handleOpenReport = (auditId: string) => {
        const audit = mockData.audits.find(a => a.id === auditId);
        if (!audit) return;

        const grid = mockData.grids.find(g => g.id === audit.gridId);
        if (!grid) return;

        const auditor = mockData.users.find(u => u.id === audit.auditorId);
        const actionPlans = mockData.actionPlans.filter(p => audit.findings.some(f => f.id === p.findingId));

        setReportData({
            audit,
            grid,
            auditor,
            actionPlans,
            users: mockData.users,
        });
    };
    
    const handleSavePolicy = (policyData: PolicySubmitData) => {
        const isEditing = 'id' in policyData;
        const authorId = currentUser?.id;
        
        if (!authorId) {
             addToast('Erro: Usuário não autenticado.', 'error');
             return;
        }

        // For editing, check if content or indicators have changed to decide on versioning.
        if (isEditing) {
            const originalPolicy = mockData.policies.find(p => p.id === policyData.id);
            if (!originalPolicy) {
                addToast('Erro: Política original não encontrada.', 'error');
                return;
            }

            const contentChanged = originalPolicy.content !== policyData.content;
            const indicatorsChanged = JSON.stringify(originalPolicy.performanceIndicators) !== JSON.stringify(policyData.performanceIndicators);
            
            if (contentChanged || indicatorsChanged) {
                 setVersionConfirmState({ policyData, isOpen: true });
                 return; // Wait for user decision
            }
        }
        
        // Save without versioning for new policies or if no significant change
        mockData.savePolicy(policyData, { authorId });
        addToast(isEditing ? 'Política atualizada.' : 'Política criada com sucesso.');
        setCreatePolicyModalOpen(false);
        setPolicyToEdit(null);
    };

    const handleVersionConfirm = (decision: 'new' | 'update', changeDescription?: string) => {
        if (!versionConfirmState || !currentUser) return;

        const { policyData } = versionConfirmState;
        const isEditing = 'id' in policyData;
        const options = {
            createNewVersion: decision === 'new',
            changeDescription: changeDescription,
            authorId: currentUser.id,
        };

        mockData.savePolicy(policyData, options);
        addToast(isEditing ? 'Política atualizada.' : 'Política criada com sucesso.');

        // Close all relevant modals
        setVersionConfirmState(null);
        setCreatePolicyModalOpen(false);
        setPolicyToEdit(null);
    };

    const handleSaveMeeting = (meetingData: Omit<Meeting, 'id'> | Meeting) => {
        if (!currentUser) return;
        const fullMeetingData = 'id' in meetingData ? meetingData : { ...meetingData, organizerId: currentUser.id };
        
        const savedMeeting = mockData.saveMeeting(fullMeetingData);
        
        setCreateMeetingModalOpen(false);
        setMeetingToEdit(null);

        const policy = mockData.policies.find(p => p.id === savedMeeting.policyId);
        const attendees = mockData.users.filter(u => savedMeeting.attendeeIds.includes(u.id));
        const organizer = currentUser;

        const { content, filename } = generateICSFile(savedMeeting, policy, attendees, organizer);
        
        const mailtoAttendees = attendees.map(u => u.email).join(',');
        const mailtoSubject = `Convite: ${savedMeeting.title}`;
        const mailtoBody = `Olá,\n\nVocê está convidado para a reunião "${savedMeeting.title}".\n\nPor favor, encontre o convite do calendário em anexo.\n\nDescrição: ${savedMeeting.description}\n\nObrigado,\n${organizer.name}`;
        
        const mailtoUrl = `mailto:${mailtoAttendees}?subject=${encodeURIComponent(mailtoSubject)}&body=${encodeURIComponent(mailtoBody)}`;

        setInvitationDetails({ content, filename, mailtoUrl });
    };

    // Render logic
    const selectedAudit = selectedAuditId ? mockData.audits.find(a => a.id === selectedAuditId) : null;
    const selectedGrid = selectedAudit ? mockData.grids.find(g => g.id === selectedAudit.gridId) : null;

    if (!currentUser) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    const renderPage = () => {
        if (selectedAudit && selectedGrid) {
            return (
                <AuditDetails
                    audit={selectedAudit}
                    grid={selectedGrid}
                    auditor={mockData.users.find(u => u.id === selectedAudit.auditorId)}
                    users={mockData.users}
                    actionPlans={mockData.actionPlans.filter(p => selectedAudit.findings.some(f => f.id === p.findingId))}
                    onUpdateFindingStatus={mockData.updateFindingStatus}
                    onUpdateFindingDescription={mockData.updateFindingDescription}
                    onAttachFile={mockData.addAttachment}
                    onDeleteAttachment={mockData.deleteAttachment}
                    onUpdateActionPlanStatus={mockData.updateActionPlanStatus}
                    onAddFollowUp={(planId, content) => mockData.addFollowUpToActionPlan(planId, content, currentUser.id)}
                    onCreateActionPlan={(findingId) => handleOpenCreateActionPlanModal({ findingId })}
                    onEditActionPlan={handleOpenEditActionPlanModal}
                    onGetAIAssistance={handleGetAIAssistance}
                    aiRecommendation={aiRecommendation}
                    isGeneratingAIRecommendation={isGeneratingAIRecommendation}
                    onUpdateAuditStatus={mockData.updateAuditStatus}
                    currentUser={currentUser}
                />
            );
        }

        switch (currentPage) {
            case 'dashboard':
                return <Dashboard audits={mockData.audits} actionPlans={mockData.actionPlans} currentUser={currentUser} onNavigate={handleNavigate} />;
            case 'audits':
                return <AuditList audits={mockData.audits} users={mockData.users} onSelectAudit={handleSelectAudit} onCreateAudit={() => setCreateAuditModalOpen(true)} onUpdateAuditStatus={mockData.updateAuditStatus} currentUser={currentUser} onOpenReport={handleOpenReport} />;
            case 'grids':
                return <GridManagement grids={mockData.grids} onCreateGrid={() => { setGridToEdit(null); setCreateGridModalOpen(true); }} onEditGrid={handleEditGrid} onDeleteGrid={mockData.deleteGrid} currentUser={currentUser} />;
            case 'users':
                return <UserManagement users={mockData.users} onCreateUser={handleOpenCreateUserModal} onEditUser={handleOpenEditUserModal} currentUser={currentUser} />;
            case 'chatbot':
                return <Chatbot currentUser={currentUser} audits={mockData.audits} grids={mockData.grids} actionPlans={mockData.actionPlans} />;
            case 'policies':
                 return <PolicyManagement 
                    policies={mockData.policies} 
                    currentUser={currentUser}
                    onCreatePolicy={() => { setPolicyToEdit(null); setCreatePolicyModalOpen(true); }}
                    onEditPolicy={(policy) => { setPolicyToEdit(policy); setCreatePolicyModalOpen(true); }}
                    onDeletePolicy={(policy) => setPolicyToDelete(policy)}
                    onOpenViewPolicy={(policy) => setPolicyToView(policy)}
                    users={mockData.users}
                    meetings={mockData.meetings}
                    onOpenCreateMeeting={(date) => { setMeetingToEdit(null); setDefaultMeetingDate(date || null); setCreateMeetingModalOpen(true); }}
                    onCancelMeeting={(meeting) => setMeetingToCancel(meeting)}
                    onEditMeeting={(meeting) => { setMeetingToEdit(meeting); setCreateMeetingModalOpen(true); }}
                    onAddFollowUp={(planId, content) => mockData.addFollowUpToActionPlan(planId, content, currentUser.id)}
                 />;
            default:
                return <Dashboard audits={mockData.audits} actionPlans={mockData.actionPlans} currentUser={currentUser} onNavigate={handleNavigate} />;
        }
    };
    
    return (
        <div className="flex h-screen bg-background dark:bg-dark-background text-on-background dark:text-dark-on-background">
            <Sidebar onNavigate={handleNavigate} currentPage={currentPage} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header 
                    currentUser={currentUser} 
                    onLogout={handleLogout} 
                    onBack={selectedAuditId ? handleBackToAudits : undefined}
                    onUpdateAvatar={handleUpdateCurrentUserAvatar}
                    notifications={mockData.notifications.filter(n => n.userId === currentUser.id)}
                    onMarkNotificationRead={mockData.markNotificationRead}
                    onMarkAllNotificationsRead={() => mockData.markAllNotificationsRead(currentUser.id)}
                />
                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    {renderPage()}
                </main>
            </div>
            
            {/* Modals */}
            <CreateUserModal
                isOpen={isCreateUserModalOpen}
                onClose={() => setCreateUserModalOpen(false)}
                onSubmit={handleSaveUser}
                userToEdit={userToEdit}
                allUsers={mockData.users}
            />
            <CreateAuditModal
                isOpen={isCreateAuditModalOpen}
                onClose={() => setCreateAuditModalOpen(false)}
                onSave={handleSaveAudit}
                users={mockData.users}
                grids={mockData.grids}
            />
            <CreateGridModal
                isOpen={isCreateGridModalOpen}
                onClose={() => setCreateGridModalOpen(false)}
                onSave={handleSaveGrid}
                gridToEdit={gridToEdit}
            />
             <CreateActionPlanModal
                isOpen={isCreateActionPlanModalOpen}
                onClose={() => setCreateActionPlanModalOpen(false)}
                onSave={handleSaveActionPlan}
                users={mockData.users}
                findingId={currentFindingIdForActionPlan}
                performanceIndicatorId={currentIndicatorIdForActionPlan}
                planToEdit={actionPlanToEdit}
            />
            <ReportModal
                isOpen={!!reportData}
                onClose={() => setReportData(null)}
                data={reportData}
            />
            <CreatePolicyModal
                isOpen={isCreatePolicyModalOpen}
                onClose={() => { setCreatePolicyModalOpen(false); setPolicyToEdit(null); }}
                onSave={handleSavePolicy}
                policyToEdit={policyToEdit}
                users={mockData.users}
            />
            {policyToView && (
                <ViewPolicyModal
                    isOpen={!!policyToView}
                    onClose={() => setPolicyToView(null)}
                    policy={policyToView}
                    policyHistory={mockData.policyHistory}
                    users={mockData.users}
                    actionPlans={mockData.actionPlans.filter(p => policyToView.performanceIndicators.some(i => i.id === p.performanceIndicatorId))}
                    onCreateActionPlan={(indicatorId) => handleOpenCreateActionPlanModal({ indicatorId })}
                    onEditActionPlan={handleOpenEditActionPlanModal}
                    onAddFollowUp={(planId, content) => mockData.addFollowUpToActionPlan(planId, content, currentUser.id)}
                    onUpdateActionPlanStatus={mockData.updateActionPlanStatus}
                    currentUser={currentUser}
                />
            )}
            {policyToDelete && (
                <ConfirmationModal
                    isOpen={!!policyToDelete}
                    onClose={() => setPolicyToDelete(null)}
                    onConfirm={() => {
                        mockData.deletePolicy(policyToDelete.id);
                        addToast(`Política "${policyToDelete.title}" excluída.`);
                        setPolicyToDelete(null);
                    }}
                    title="Excluir Política"
                    message={`Tem certeza que deseja excluir a política "${policyToDelete.title}"? Esta ação não pode ser desfeita.`}
                />
            )}
            {versionConfirmState?.isOpen && (
                <VersionConfirmationModal
                    isOpen={versionConfirmState.isOpen}
                    onClose={() => setVersionConfirmState(null)}
                    onConfirm={handleVersionConfirm}
                />
            )}
            <CreateMeetingModal
                isOpen={isCreateMeetingModalOpen}
                onClose={() => { setCreateMeetingModalOpen(false); setMeetingToEdit(null); }}
                onSave={handleSaveMeeting}
                policies={mockData.policies}
                users={mockData.users}
                defaultDate={defaultMeetingDate}
                meetingToEdit={meetingToEdit}
            />
            {invitationDetails && (
                <MeetingConfirmationModal
                    isOpen={!!invitationDetails}
                    onClose={() => setInvitationDetails(null)}
                    invitationDetails={invitationDetails}
                />
            )}
            {meetingToCancel && (
                 <ConfirmationModal
                    isOpen={!!meetingToCancel}
                    onClose={() => setMeetingToCancel(null)}
                    onConfirm={() => {
                        mockData.deleteMeeting(meetingToCancel.id);
                        addToast(`Reunião "${meetingToCancel.title}" cancelada.`);
                        setMeetingToCancel(null);
                    }}
                    title="Cancelar Reunião"
                    message={`Tem certeza que deseja cancelar a reunião "${meetingToCancel.title}"? Os participantes serão notificados.`}
                />
            )}


            {/* Toast Container */}
            <div className="fixed bottom-5 right-5 z-50 space-y-2">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    />
                ))}
            </div>
        </div>
    );
};

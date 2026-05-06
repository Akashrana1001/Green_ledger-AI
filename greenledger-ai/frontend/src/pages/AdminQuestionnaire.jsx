import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import MI from '../components/MI';
import { AdminSidebarLinks } from '../components/AdminSidebar';
import { BRSR_QUALITATIVE_QUESTIONS, QUESTION_GROUPS } from '../constants/brsrQuestions';

const AdminQuestionnaire = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [responses, setResponses] = useState({});
  const [progress, setProgress] = useState({ answered: 0, total: 31 });
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [assigning, setAssigning] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [qualRes, usersRes] = await Promise.all([
        axiosClient.get('/api/qualitative'),
        axiosClient.get('/api/auth/users'),
      ]);
      const responseMap = {};
      qualRes.data.responses.forEach(r => { responseMap[r.questionId] = r; });
      setResponses(responseMap);
      setProgress(qualRes.data.progress);
      setTeamMembers((usersRes.data.users || []).filter(u => u.role === 'TeamMember'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load questionnaire');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const toggleGroup = (group) => setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));

  const handleAssign = async (questionId, assignedTo) => {
    setAssigning(prev => ({ ...prev, [questionId]: true }));
    try {
      await axiosClient.post('/api/qualitative/assign', { questionId, assignedTo: assignedTo || null });
      setResponses(prev => {
        const current = prev[questionId] || {};
        return {
          ...prev,
          [questionId]: {
            ...current,
            assignedTo: assignedTo ? teamMembers.find(m => m._id === assignedTo) || assignedTo : null,
            status: assignedTo ? (current.status === 'answered' ? 'answered' : 'assigned') : 'unassigned',
          },
        };
      });
      toast.success(assignedTo ? 'Question assigned' : 'Assignment cleared');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed');
    } finally {
      setAssigning(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.answered / progress.total) * 100) : 0;
  const pending = progress.total - progress.answered;
  const inProgress = Object.values(responses).filter(r => r.status === 'assigned').length;

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-500 text-sm">Loading BRSR questionnaire...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Purple orb */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] purple-orb -z-0 opacity-20 translate-x-1/4 -translate-y-1/4" />

      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#050505] border-b border-white/10 flex items-center justify-between px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 ai-gradient-bg rounded-lg flex items-center justify-center">
              <MI icon="eco" className="text-white text-base" fill />
            </div>
            <span className="font-bold text-base tracking-tight">GreenLedger AI</span>
          </Link>
          <nav className="hidden md:flex gap-6 text-sm">
            <Link to="/admin/dashboard" className="text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
            <span className="text-green-400 font-semibold border-b-2 border-green-700 pb-0.5">Questionnaire</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin/war-room"
            className="flex items-center gap-2 px-4 py-2 ai-gradient-bg rounded-lg text-white text-sm font-semibold">
            <MI icon="visibility" className="text-base" /> AI War Room
          </Link>
          <button onClick={handleLogout} className="text-zinc-400 hover:text-white transition-colors">
            <MI icon="logout" className="text-xl" />
          </button>
        </div>
      </header>

      {/* Left Sidebar */}
      <aside className="fixed left-0 top-16 w-64 h-[calc(100vh-64px)] z-40 flex flex-col bg-[#050505] border-r border-white/10">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 ai-gradient-bg rounded-xl flex items-center justify-center">
              <MI icon="shield_person" className="text-white text-xl" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Enterprise Admin</h3>
              <p className="text-zinc-600 text-[10px] uppercase tracking-widest">BRSR Manager</p>
            </div>
          </div>
          <nav className="space-y-1">
            <AdminSidebarLinks />
          </nav>
          <div className="mt-6">
            <Link to="/admin/dashboard"
              className="w-full py-2.5 rounded-lg border border-green-700/30 text-green-400 hover:bg-green-900/20 transition-all flex items-center justify-center gap-2 font-semibold text-sm">
              <MI icon="arrow_back" className="text-base" /> Back to Dashboard
            </Link>
          </div>
        </div>
        <div className="mt-auto p-6 space-y-1">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-white w-full transition-all text-sm">
            <MI icon="logout" className="text-xl" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 pt-24 px-10 pb-12">
        {/* Page Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">
            SEBI BRSR Questionnaire & Delegation
          </h1>
          <p className="text-zinc-400 max-w-2xl text-sm leading-relaxed">
            Assign specific NGRBC principles to your team members for evidence collection.
            Track completion and review submitted answers before generating the final report.
          </p>
        </div>

        {/* Stats bento row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Questions', value: progress.total, color: 'text-white' },
            { label: 'Pending Assignment', value: pending, color: 'text-yellow-400' },
            { label: 'In Progress', value: inProgress, color: 'text-green-400' },
            { label: 'Completion Rate', value: `${pct}%`, color: pct === 100 ? 'text-green-400' : 'text-green-400' },
          ].map(stat => (
            <div key={stat.label} className="glass-panel rounded-xl p-5">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">{stat.label}</p>
              <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="glass-panel rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-400">Overall Completion</p>
            <span className={`font-bold text-sm ${pct === 100 ? 'text-green-400' : 'text-green-400'}`}>{pct}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-500' : 'ai-gradient-bg'} shadow-[0_0_8px_rgba(168,85,247,0.4)]`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct < 100 && (
            <p className="text-yellow-400/80 text-xs mt-3 flex items-center gap-1.5">
              <MI icon="warning" className="text-sm" fill />
              Complete all qualitative responses before generating the final BRSR report.
              Assign questions to team members to parallelize work.
            </p>
          )}
        </div>

        {/* Grouped questions */}
        <div className="space-y-4">
          {QUESTION_GROUPS.map(group => {
            const groupQuestions = BRSR_QUALITATIVE_QUESTIONS.filter(q => q.group === group);
            const isCollapsed = collapsedGroups[group];
            const groupAnswered = groupQuestions.filter(q => responses[q.id]?.status === 'answered').length;

            return (
              <div key={group} className="glass-panel rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full px-6 py-4 border-b border-white/10 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MI icon="folder_open" className="text-green-400 text-xl" />
                    <span className="font-semibold text-white text-sm">{group}</span>
                    <span className="text-[10px] font-bold text-zinc-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                      {groupAnswered}/{groupQuestions.length}
                    </span>
                  </div>
                  <MI icon={isCollapsed ? 'expand_more' : 'expand_less'} className="text-zinc-500 text-xl" />
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-white/5">
                    {groupQuestions.map(q => {
                      const resp = responses[q.id] || {};
                      const status = resp.status || 'unassigned';
                      const assignedId = resp.assignedTo?._id || resp.assignedTo || '';
                      const answeredByName = resp.answeredBy?.fullName || '';
                      const answeredDate = resp.answeredAt
                        ? new Date(resp.answeredAt).toLocaleDateString('en-IN')
                        : '';

                      const statusCfg = {
                        unassigned: { icon: 'warning', label: 'Unassigned', cls: 'text-yellow-400' },
                        assigned: { icon: 'check_circle', label: 'Assigned', cls: 'text-green-400' },
                        answered: { icon: 'verified', label: 'Answered', cls: 'text-green-400' },
                      }[status] || { icon: 'warning', label: 'Unassigned', cls: 'text-yellow-400' };

                      return (
                        <div key={q.id} className="p-5 flex items-start justify-between gap-6 group hover:bg-white/[0.01] transition-colors">
                          {/* Left: principle + status */}
                          <div className="flex flex-col gap-2 w-28 flex-shrink-0">
                            <span className="bg-emerald-950/40 text-green-400 border border-green-700/40 text-[10px] font-black w-fit px-2.5 py-1 rounded-full tracking-widest uppercase">
                              {q.principle}
                            </span>
                            <div className={`flex items-center gap-1.5 ${statusCfg.cls}`}>
                              <MI icon={statusCfg.icon} className="text-sm" fill />
                              <span className="text-[11px] font-bold">{statusCfg.label}</span>
                            </div>
                          </div>

                          {/* Center: question */}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium leading-relaxed mb-1">{q.question}</p>
                            {q.followUp && (
                              <p className="text-zinc-500 text-xs italic">{q.followUp}</p>
                            )}
                            {status === 'answered' && (
                              <div className="mt-3 bg-emerald-500/5 border border-green-700/30 rounded-lg px-4 py-3">
                                {resp.answerYesNo && (
                                  <p className="text-xs text-green-400 font-medium uppercase tracking-wide mb-1">
                                    Answer: {resp.answerYesNo}
                                  </p>
                                )}
                                {resp.answer && (
                                  <p className="text-zinc-300 text-sm">
                                    {resp.answer.length > 80 ? `${resp.answer.slice(0, 80)}…` : resp.answer}
                                  </p>
                                )}
                                <p className="text-zinc-600 text-[10px] mt-1">
                                  {answeredByName ? `Answered by ${answeredByName}` : 'Answered'}
                                  {answeredDate ? ` · ${answeredDate}` : ''}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Right: assign dropdown */}
                          <div className="flex-shrink-0">
                            <select
                              value={typeof assignedId === 'object' ? assignedId?.toString() : (assignedId || '')}
                              onChange={e => handleAssign(q.id, e.target.value || null)}
                              disabled={assigning[q.id]}
                              className={`bg-zinc-900 border text-sm rounded-lg px-4 py-2.5 min-w-[180px] focus:outline-none transition-all disabled:opacity-50 ${
                                status === 'assigned' || status === 'answered'
                                  ? 'border-green-700/20 text-purple-200 bg-green-900/20'
                                  : 'border-white/10 text-zinc-300 hover:border-green-700/40'
                              }`}
                            >
                              <option value="">Assign to...</option>
                              {teamMembers.map(m => (
                                <option key={m._id} value={m._id}>{m.fullName}</option>
                              ))}
                            </select>
                            {assigning[q.id] && (
                              <p className="text-xs text-zinc-500 text-center mt-1 animate-pulse">Saving...</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Compliance flow CTA — Step 1 done → continue to AI War Room ── */}
        <div className="mt-10 glass-panel rounded-2xl overflow-hidden">
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Step indicators */}
            <div className="md:col-span-2 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-700/50 flex items-center justify-center">
                  <MI icon="check" className="text-emerald-400 text-sm" fill />
                </div>
                <div>
                  <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Step 1</p>
                  <p className="text-white text-sm font-semibold">Questionnaire</p>
                </div>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-emerald-700/40 via-emerald-700/20 to-white/5" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-zinc-400 text-xs font-bold">2</span>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Step 2</p>
                  <p className="text-zinc-300 text-sm font-semibold">AI War Room</p>
                </div>
              </div>
              <div className="flex-1 h-px bg-white/5" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-zinc-400 text-xs font-bold">3</span>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Step 3</p>
                  <p className="text-zinc-300 text-sm font-semibold">Generate Report</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Link
              to="/admin/war-room"
              className="flex items-center justify-center gap-2 px-6 py-4 ai-gradient-bg rounded-xl text-white text-sm font-bold hover:opacity-90 transition-all shadow-[0_0_24px_rgba(16,185,129,0.30)]"
            >
              Continue to AI War Room <MI icon="arrow_forward" className="text-base" />
            </Link>
          </div>

          {pct < 100 && (
            <div className="px-8 py-3 bg-yellow-950/20 border-t border-yellow-800/30 flex items-center gap-2 text-yellow-400 text-xs">
              <MI icon="info" className="text-sm" />
              You can proceed now, but {pending} question{pending !== 1 ? 's' : ''} remain unanswered. Final report quality improves with full completion.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminQuestionnaire;

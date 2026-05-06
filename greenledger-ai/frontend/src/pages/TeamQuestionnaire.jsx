import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import MI from '../components/MI';
import { BRSR_QUALITATIVE_QUESTIONS } from '../constants/brsrQuestions';

const QuestionForm = ({ question, initialResponse, onSaved }) => {
  const [editing, setEditing] = useState(!initialResponse || initialResponse.status !== 'answered');
  const [answerYesNo, setAnswerYesNo] = useState(initialResponse?.answerYesNo || '');
  const [answer, setAnswer] = useState(initialResponse?.answer || '');
  const [webLink, setWebLink] = useState(initialResponse?.webLink || '');
  const [notes, setNotes] = useState(initialResponse?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!answer.trim() && !answerYesNo) {
      toast.error('Please provide an answer before saving.');
      return;
    }
    setSaving(true);
    try {
      await axiosClient.put('/api/qualitative/answer', {
        questionId: question.id, answer, answerYesNo, webLink, notes,
      });
      toast.success('Answer saved');
      setEditing(false);
      onSaved({ questionId: question.id, answer, answerYesNo, webLink, notes, status: 'answered' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const isAnswered = !editing && initialResponse?.status === 'answered';
  const inputClass = "w-full bg-[#0e0e10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-green-700/50 focus:ring-1 focus:ring-green-700/20 transition-all resize-y";

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="bg-emerald-950/40 text-green-400 border border-green-700/40 text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">
              {question.principle}
            </span>
            <span className="text-zinc-600 text-xs">{question.group}</span>
            {isAnswered && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/20 text-green-400 border border-green-700/30">
                <MI icon="verified" className="text-sm" fill /> Answered
              </span>
            )}
          </div>
          <p className="text-white text-sm font-medium leading-relaxed">{question.question}</p>
          {question.followUp && (
            <p className="text-zinc-500 text-xs mt-2 italic">{question.followUp}</p>
          )}
        </div>
        {isAnswered && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-green-400 transition-colors flex-shrink-0 mt-1"
          >
            <MI icon="edit" className="text-base" /> Edit
          </button>
        )}
      </div>

      {/* Answered preview */}
      {isAnswered && !editing && (
        <div className="px-6 py-5 space-y-3">
          {answerYesNo && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Response:</span>
              <span className={`text-sm font-bold ${answerYesNo === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                {answerYesNo === 'yes' ? 'Yes' : 'No'}
              </span>
            </div>
          )}
          {answer && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Details</p>
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>
          )}
          {webLink && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Web Link</p>
              <a href={webLink} target="_blank" rel="noopener noreferrer"
                className="text-green-400 text-sm underline break-all">
                {webLink}
              </a>
            </div>
          )}
          {notes && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-zinc-400 text-sm">{notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Answer form */}
      {editing && (
        <div className="px-6 py-5 space-y-4">
          {(question.type === 'yes_no' || question.type === 'yes_no_text') && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Response</label>
              <div className="flex gap-2">
                <button onClick={() => setAnswerYesNo('yes')}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all border ${
                    answerYesNo === 'yes'
                      ? 'bg-green-700 border-emerald-600 text-white shadow-[0_0_12px_rgba(22,163,74,0.14)]'
                      : 'bg-transparent border-white/10 text-zinc-400 hover:border-emerald-500/40 hover:text-green-400'
                  }`}>Yes</button>
                <button onClick={() => setAnswerYesNo('no')}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all border ${
                    answerYesNo === 'no'
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'bg-transparent border-white/10 text-zinc-400 hover:border-red-500/40 hover:text-red-400'
                  }`}>No</button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              {question.type === 'yes_no' ? 'Additional details / web link'
                : question.type === 'yes_no_text' ? 'Please provide details'
                : 'Your answer'}
            </label>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              rows={question.type === 'text' ? 5 : 3}
              placeholder="Enter your response here..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Web Link (optional)</label>
            <input type="url" value={webLink} onChange={e => setWebLink(e.target.value)}
              placeholder="https://example.com/policy"
              className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Internal Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Any caveats or internal context..."
              className={inputClass} />
          </div>

          <div className="flex gap-3 pt-1">
            {initialResponse?.status === 'answered' && (
              <button onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm border border-white/10 rounded-lg text-zinc-400 hover:border-white/20 transition-colors">
                Cancel
              </button>
            )}
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-green-700 to-green-900 hover:brightness-110 disabled:opacity-50 rounded-lg text-white text-sm font-bold transition-all shadow-[0_0_16px_rgba(183,109,255,0.25)] flex items-center gap-2">
              {saving
                ? <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Saving...</>
                : <><MI icon="save" className="text-base" />Save Answer</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const TeamQuestionnaire = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [assignedQuestions, setAssignedQuestions] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await axiosClient.get('/api/qualitative');
      const responseMap = {};
      res.data.responses.forEach(r => { responseMap[r.questionId] = r; });
      setResponses(responseMap);
      setAssignedQuestions(BRSR_QUALITATIVE_QUESTIONS.filter(q => responseMap[q.id]));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load assigned questions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleSaved = (updated) => {
    setResponses(prev => ({
      ...prev,
      [updated.questionId]: { ...prev[updated.questionId], ...updated },
    }));
  };

  const answeredCount = assignedQuestions.filter(q => responses[q.id]?.status === 'answered').length;
  const pct = assignedQuestions.length > 0
    ? Math.round((answeredCount / assignedQuestions.length) * 100) : 0;

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-500 text-sm">Loading your tasks...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="fixed top-0 right-0 w-[500px] h-[500px] purple-orb -z-0 opacity-20 translate-x-1/4 -translate-y-1/4" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#050505]/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link to="/team/portal" className="text-zinc-400 hover:text-white transition-colors">
            <MI icon="arrow_back" className="text-xl" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 ai-gradient-bg rounded-lg flex items-center justify-center">
              <MI icon="assignment_turned_in" className="text-white text-sm" fill />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight">My BRSR Tasks</h1>
              <p className="text-zinc-500 text-[10px]">Welcome, {user?.fullName || 'Team Member'}</p>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
          <MI icon="logout" className="text-xl" />
        </button>
      </header>

      <main className="pt-24 pb-12 px-6 max-w-3xl mx-auto space-y-5">
        {/* Progress card */}
        {assignedQuestions.length > 0 && (
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-zinc-400 text-sm mb-1">Your Progress</p>
                <p className="text-2xl font-bold text-white">
                  {answeredCount}
                  <span className="text-zinc-500 text-base font-normal"> / {assignedQuestions.length} answered</span>
                </p>
              </div>
              <p className={`text-4xl font-black ${pct === 100 ? 'text-green-400' : 'text-green-400'}`}>{pct}%</p>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-500' : 'ai-gradient-bg'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Empty state */}
        {assignedQuestions.length === 0 && (
          <div className="glass-panel rounded-2xl p-16 text-center">
            <MI icon="assignment" className="text-zinc-700 text-6xl mb-4" />
            <h3 className="text-white font-semibold text-lg mb-2">No questions assigned yet</h3>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto">
              Ask your Admin to assign BRSR questionnaire tasks.
              Once assigned, they will appear here for you to answer.
            </p>
          </div>
        )}

        {/* Question cards */}
        {assignedQuestions.map(q => (
          <QuestionForm
            key={q.id}
            question={q}
            initialResponse={responses[q.id]}
            onSaved={handleSaved}
          />
        ))}
      </main>
    </div>
  );
};

export default TeamQuestionnaire;

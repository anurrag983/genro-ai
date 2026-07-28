import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BookMarked,
  BookOpen,
  Bot,
  Camera,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Dna,
  Edit3,
  FileCheck,
  FileText,
  Flame,
  FlaskConical,
  Home,
  LogOut,
  Mail,
  MessageCircle,
  Paperclip,
  Pencil,
  Phone,
  PlayCircle,
  RefreshCw,
  Rocket,
  Send,
  Search,
  Sigma,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  User,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { API_BASE_URL, api, fetchQuizPayload } from './api';
import './index.css';

const SESSION_KEY = 'genro-session';

const SUBJECTS = [
  {
    name: 'Physics',
    apiName: 'Physics',
    icon: Activity,
    description: 'Build intuition with concepts, diagrams, and practice.',
    accent: 'violet',
  },
  {
    name: 'Chemistry',
    apiName: 'Chemistry',
    icon: FlaskConical,
    description: 'Strengthen reactions, calculations, and NCERT recall.',
    accent: 'rose',
  },
  {
    name: 'Biology',
    apiName: 'Biology',
    icon: Dna,
    description: 'Turn dense chapters into confident, lasting recall.',
    accent: 'teal',
  },
  {
    name: 'Mathematics',
    apiName: 'Maths',
    icon: Sigma,
    description: 'Build speed, problem-solving patterns, and mathematical confidence.',
    accent: 'amber',
  },
];

const NAVIGATION = [
  { id: 'home', label: 'Overview', icon: Home },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'custom', label: 'Custom Practice', icon: Sparkles },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'tutor', label: 'AI Tutor', icon: MessageCircle },
  { id: 'profile', label: 'Profile', icon: User },
];

function getStoredSession() {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function persistSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // A blocked browser storage should not prevent the app from working.
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // No action needed when storage is unavailable.
  }
}

function initials(name = 'Genro Learner') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function displayNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPercent(value) {
  return `${Math.round(displayNumber(value))}%`;
}

function formatDate(value) {
  if (!value) return 'Not attempted yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(date);
}

function normalizeUser(user) {
  return {
    user_id: user.user_id,
    full_name: user.full_name || 'Genro Learner',
    email: user.email || '',
    mobile_no: user.mobile_no || '',
    class_level: user.class_level || 'CLASS 12',
    board: user.board || 'CBSE',
    study_track: normalizeStudyTrack(user.study_track),
    total_xp: displayNumber(user.total_xp),
    day_streak: displayNumber(user.day_streak),
  };
}

function normalizeStudyTrack(track) {
  return String(track || '').trim().toLowerCase().replace(/[_\s-]+/g, '') === 'nonmedical'
    ? 'Non-Medical'
    : 'Medical';
}

function subjectsForTrack(track) {
  const wantedNames = normalizeStudyTrack(track) === 'Medical'
    ? ['Physics', 'Chemistry', 'Biology']
    : ['Physics', 'Chemistry', 'Mathematics'];
  return SUBJECTS.filter((subject) => wantedNames.includes(subject.name));
}

function canonicalSubject(subject) {
  const normalized = String(subject || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.startsWith('phys')) return 'Physics';
  if (normalized.startsWith('chem')) return 'Chemistry';
  if (normalized.startsWith('bio')) return 'Biology';
  if (normalized === 'math' || normalized === 'maths' || normalized === 'mathematics') return 'Mathematics';
  return String(subject || '').trim();
}

function normaliseProgressItem(item = {}) {
  return {
    ...item,
    status: item.status || item.progress_status || '',
    subject_name: canonicalSubject(item.subject_name || item.subject || item.subjectName),
    topic_name: item.topic_name || item.topic || item.topicName || 'Untitled topic',
    chapter_name: item.chapter_name || item.chapter || item.chapterName || '',
    accuracy_percentage: displayNumber(item.accuracy_percentage ?? item.accuracy ?? item.score),
    tests_attempted: Math.max(1, displayNumber(item.tests_attempted ?? item.attempts, 1)),
    last_tested_at: item.last_tested_at || item.attempted_at || item.created_at || item.tested_at || null,
  };
}

function normalizeProgressData(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const allProgress = (source.all_progress || source.progress || source.topic_progress || []).map(normaliseProgressItem);
  const testHistory = (source.test_history || source.testHistory || source.history || source.attempts || []).map(normaliseProgressItem);
  const revisionRequired = source.revision_required || source.revision_required_items || source.weak_topics || [];
  const strongSource = source.strong_topics || [];
  const isRevisionRequired = (item) => item.status === 'Revision Required' || displayNumber(item.accuracy_percentage) < 70;
  const isStrong = (item) => item.status === 'Mastered' || displayNumber(item.accuracy_percentage) >= 70;
  const weakTopics = (revisionRequired.length ? revisionRequired : allProgress.filter(isRevisionRequired)).map(normaliseProgressItem);
  const strongTopics = (strongSource.length ? strongSource : allProgress.filter(isStrong)).map(normaliseProgressItem);
  const weightedItems = testHistory.length ? testHistory : allProgress;
  const calculatedTotal = testHistory.length
    ? testHistory.length
    : allProgress.reduce((total, item) => total + displayNumber(item.tests_attempted, 1), 0);
  const calculatedAccuracyWeight = weightedItems.reduce((total, item) => (
    total + displayNumber(item.accuracy_percentage) * (testHistory.length ? 1 : displayNumber(item.tests_attempted, 1))
  ), 0);
  const summary = source.summary || {};
  const totalTests = Number.isFinite(Number(summary.total_tests)) ? displayNumber(summary.total_tests) : calculatedTotal;
  const avgAccuracy = Number.isFinite(Number(summary.avg_accuracy))
    ? displayNumber(summary.avg_accuracy)
    : (calculatedTotal ? calculatedAccuracyWeight / calculatedTotal : 0);

  return {
    summary: {
      total_tests: totalTests,
      avg_accuracy: Math.round(avgAccuracy * 10) / 10,
      topics_covered: Number.isFinite(Number(summary.topics_covered)) ? displayNumber(summary.topics_covered) : allProgress.length,
    },
    strong_topics: strongTopics,
    weak_topics: weakTopics,
    revision_required: weakTopics,
    all_progress: allProgress,
    test_history: testHistory,
    has_response_data: Boolean(source.summary || allProgress.length || testHistory.length || source.strong_topics || source.weak_topics || source.revision_required),
  };
}

// SPEED FIX: Study and Custom Practice used to each keep their own private
// per-component cache (a useRef Map), so leaving a page and coming back — or
// simply switching between Study and Custom Practice — re-hit the backend
// every time, and the render-blocking wait made opening a subject's chapters
// feel slow. This cache lives at module scope, so it survives page switches
// and unmounts, and in-flight requests are de-duped so tapping the same
// subject twice never fires a second request.
const syllabusCache = new Map();

function syllabusCacheKey(classLevel, subjectName) {
  return `${classLevel}:${subjectName}`;
}

function loadSyllabus(classLevel, subjectName) {
  const key = syllabusCacheKey(classLevel, subjectName);
  if (syllabusCache.has(key)) return syllabusCache.get(key);
  const request = api.getSyllabus(classLevel, subjectName)
    .then((response) => response.data || [])
    .catch((error) => {
      // Don't cache failures — a cold-started backend or a dropped request
      // should be retried the next time this subject is opened.
      syllabusCache.delete(key);
      throw error;
    });
  syllabusCache.set(key, request);
  return request;
}

// Quietly warms the cache for every subject on the student's track as soon as
// the Study/Custom Practice area is opened, so tapping between subjects
// afterwards feels instant instead of triggering a fresh fetch each time.
function prefetchAllSubjects(classLevel, track) {
  subjectsForTrack(track).forEach((subject) => {
    loadSyllabus(classLevel, subject.apiName).catch(() => {});
  });
}

function getSubjectStats(progressItems, subject) {
  const matching = (progressItems || []).filter((item) => canonicalSubject(item.subject_name) === subject);
  const attempts = matching.reduce((total, item) => total + displayNumber(item.tests_attempted, 1), 0);
  const accuracy = attempts
    ? matching.reduce((total, item) => total + displayNumber(item.accuracy_percentage) * displayNumber(item.tests_attempted, 1), 0) / attempts
    : 0;
  return { attempts, accuracy: Math.round(accuracy) };
}

export default function App() {
  const [session, setSession] = useState(getStoredSession);
  const [activePage, setActivePage] = useState('home');

  const saveSession = (user) => {
    const nextSession = normalizeUser(user);
    setSession(nextSession);
    persistSession(nextSession);
  };

  const handleLogout = () => {
    clearStoredSession();
    setSession(null);
    setActivePage('home');
  };

  if (!session?.user_id) {
    return <AuthScreen onAuthenticated={saveSession} />;
  }

  return (
    <LearningWorkspace
      initialUser={session}
      activePage={activePage}
      onPageChange={setActivePage}
      onUpdateSession={saveSession}
      onLogout={handleLogout}
    />
  );
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [signupStep, setSignupStep] = useState('details');
  const [form, setForm] = useState({
    full_name: '',
    mobile_no: '',
    email: '',
    password: '',
    class_level: 'CLASS 12',
    board: 'CBSE',
    study_track: 'Medical',
    otp: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [otpHint, setOtpHint] = useState('');
  const [coldStartNotice, setColdStartNotice] = useState('');

  useEffect(() => {
    if (!isSubmitting) {
      setColdStartNotice('');
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      setColdStartNotice('Our secure server is waking up. The first request can take up to a minute—please keep this page open.');
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [isSubmitting]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setSignupStep('details');
    setError('');
    setOtpHint('');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await api.login({ email: form.email.trim(), password: form.password });
      onAuthenticated(response.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setError('');

    if (signupStep === 'details') {
      if (!form.full_name.trim() || !form.email.trim() || !form.password || !form.mobile_no.trim()) {
        setError('Please complete your name, mobile number, email, and password.');
        return;
      }
      if (!/^\d{10}$/.test(form.mobile_no.trim())) {
        setError('Enter a valid 10-digit mobile number without +91.');
        return;
      }
      if (form.password.length < 6) {
        setError('Your password must contain at least 6 characters.');
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await api.sendOtp(form.mobile_no.trim());
        const debugOtp = response.otp_debug || '';
        setOtpHint(debugOtp ? `Verification code: ${debugOtp}` : '');
        if (debugOtp) {
          setForm((current) => ({ ...current, otp: debugOtp }));
        }
        setSignupStep('verify');
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!form.otp.trim()) {
      setError('Enter the OTP sent to your mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.verifyOtp(form.mobile_no.trim(), form.otp.trim());
      const response = await api.signup({
        full_name: form.full_name.trim(),
        mobile_no: form.mobile_no.trim(),
        email: form.email.trim(),
        password: form.password,
        class_level: form.class_level,
        board: form.board,
        study_track: form.study_track,
      });
      onAuthenticated({
        user_id: response.user_id,
        full_name: form.full_name,
        mobile_no: form.mobile_no,
        email: form.email,
        class_level: form.class_level,
        board: form.board,
        study_track: form.study_track,
        total_xp: 0,
        day_streak: 0,
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <div className="brand auth-brand">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <span>genro</span><b>AI</b>
        </div>

        <div className="auth-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> A calmer way to prepare</span>
          <h1>Make every hour of study <em>count.</em></h1>
          <p>
            A focused learning space for Class 11 and 12 science students—built around
            your syllabus, practice, progress, and questions.
          </p>
        </div>

        <div className="showcase-card" aria-label="Study plan preview">
          <div className="showcase-card-header">
            <div>
              <span className="card-kicker">TODAY'S FOCUS</span>
              <strong>Build your learning rhythm</strong>
            </div>
            <span className="showcase-spark"><Zap size={16} /></span>
          </div>
          <div className="showcase-timeline">
            <div className="timeline-item done"><span><Check size={13} /></span><p><b>Choose a topic</b><small>Follow your NCERT sequence</small></p></div>
            <div className="timeline-item active"><span><PlayCircle size={13} /></span><p><b>Practice with intent</b><small>Use live tests as they unlock</small></p></div>
            <div className="timeline-item"><span><TrendingUp size={13} /></span><p><b>See your momentum</b><small>Turn every attempt into a next step</small></p></div>
          </div>
        </div>

        <p className="auth-note">Built for NEET and board preparation · Your study data stays in your Genro account</p>
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="mobile-brand brand">
            <span className="brand-mark"><Sparkles size={18} /></span>
            <span>genro</span><b>AI</b>
          </div>
          <div className="auth-heading">
            <span className="eyebrow">{isLogin ? 'WELCOME BACK' : signupStep === 'verify' ? 'ONE LAST STEP' : 'START YOUR JOURNEY'}</span>
            <h2>{isLogin ? 'Pick up where you left off.' : signupStep === 'verify' ? 'Verify your mobile number.' : 'Create your learning space.'}</h2>
            <p>{isLogin ? 'Sign in to see your plan and progress.' : signupStep === 'verify' ? `We sent a code to ${form.mobile_no}.` : 'It takes less than a minute to get started.'}</p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Authentication options">
            <button className={isLogin ? 'active' : ''} onClick={() => switchMode('login')} type="button" role="tab" aria-selected={isLogin}>Sign in</button>
            <button className={!isLogin ? 'active' : ''} onClick={() => switchMode('signup')} type="button" role="tab" aria-selected={!isLogin}>Create account</button>
          </div>

          {error && <AlertBanner message={error} />}
          {coldStartNotice && <InfoBanner message={coldStartNotice} />}

          {isLogin ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <FormField icon={Mail} label="Email address" htmlFor="login-email">
                <input id="login-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder="you@example.com" required />
              </FormField>
              <FormField icon={Edit3} label="Password" htmlFor="login-password">
                <input id="login-password" name="password" type="password" autoComplete="current-password" value={form.password} onChange={updateField} placeholder="Your password" required />
              </FormField>
              <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? <LoaderLabel text="Signing you in" /> : <>Continue to Genro <ArrowRight size={17} /></>}
              </button>
            </form>
          ) : signupStep === 'details' ? (
            <form className="auth-form" onSubmit={handleSignup}>
              <FormField icon={User} label="Your name" htmlFor="signup-name">
                <input id="signup-name" name="full_name" type="text" autoComplete="name" value={form.full_name} onChange={updateField} placeholder="e.g. Anurag Sharma" required />
              </FormField>
              <div className="form-grid">
                <FormField icon={Phone} label="Mobile number" htmlFor="signup-mobile">
                  <input id="signup-mobile" name="mobile_no" inputMode="numeric" maxLength="10" value={form.mobile_no} onChange={updateField} placeholder="10-digit number" required />
                </FormField>
                <FormField icon={BookMarked} label="Class" htmlFor="signup-class">
                  <select id="signup-class" name="class_level" value={form.class_level} onChange={updateField}>
                    <option>CLASS 11</option>
                    <option>CLASS 12</option>
                  </select>
                </FormField>
              </div>
              <TrackPicker value={form.study_track} onChange={(study_track) => setForm((current) => ({ ...current, study_track }))} />
              <FormField icon={Mail} label="Email address" htmlFor="signup-email">
                <input id="signup-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder="you@example.com" required />
              </FormField>
              <div className="form-grid">
                <FormField icon={Edit3} label="Password" htmlFor="signup-password">
                  <input id="signup-password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={updateField} placeholder="6+ characters" required />
                </FormField>
                <FormField icon={Award} label="Board" htmlFor="signup-board">
                  <select id="signup-board" name="board" value={form.board} onChange={updateField}>
                    <option>CBSE</option>
                    <option>ISC</option>
                    <option>State Board</option>
                  </select>
                </FormField>
              </div>
              <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? <LoaderLabel text="Sending your OTP" /> : <>Send verification code <ArrowRight size={17} /></>}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSignup}>
              <div className="otp-intro">
                <span className="otp-icon"><Phone size={18} /></span>
                <div><b>Check your phone</b><p>Enter the 4-digit code sent to <strong>{form.mobile_no}</strong>.</p></div>
              </div>
              {otpHint && <div className="demo-otp"><Sparkles size={15} /> {otpHint}</div>}
              <FormField icon={CheckCircle} label="Verification code" htmlFor="signup-otp">
                <input id="signup-otp" name="otp" type="text" inputMode="numeric" maxLength="6" autoComplete="one-time-code" value={form.otp} onChange={updateField} placeholder="Enter OTP" required />
              </FormField>
              <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? <LoaderLabel text="Creating your account" /> : <>Verify & create account <ArrowRight size={17} /></>}
              </button>
              <button className="text-button centered" type="button" onClick={() => { setSignupStep('details'); setError(''); }}>Edit account details</button>
            </form>
          )}

          <p className="auth-footnote">By continuing, you agree to use Genro AI responsibly for your own learning.</p>
        </div>
      </section>
    </main>
  );
}

function LearningWorkspace({ initialUser, activePage, onPageChange, onUpdateSession, onLogout }) {
  const [user, setUser] = useState(initialUser);
  const [dashboard, setDashboard] = useState(initialUser);
  const [progress, setProgress] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [reloadIndex, setReloadIndex] = useState(0);
  const [quizDescriptor, setQuizDescriptor] = useState(null);
  const [quizReturnPage, setQuizReturnPage] = useState('study');

  useEffect(() => {
    let isCurrent = true;

    async function loadWorkspace() {
      setIsLoading(true);
      setDataError('');
      const [dashboardResult, progressResult] = await Promise.allSettled([
        api.getDashboard(initialUser.user_id),
        api.getProgress(initialUser.user_id),
      ]);

      if (!isCurrent) return;

      let nextUser = initialUser;
      const errors = [];
      if (dashboardResult.status === 'fulfilled') {
        nextUser = normalizeUser({ ...initialUser, ...dashboardResult.value.data });
        setDashboard(nextUser);
        setUser(nextUser);
        onUpdateSession(nextUser);
      } else {
        errors.push(dashboardResult.reason.message);
      }

      if (progressResult.status === 'fulfilled') {
        setProgress(normalizeProgressData(progressResult.value.data));
      } else {
        errors.push(progressResult.reason.message);
      }

      if (errors.length) setDataError(errors[0]);
      setIsLoading(false);
    }

    loadWorkspace();
    return () => { isCurrent = false; };
  // onUpdateSession is intentionally omitted — it's an inline function that
  // re-creates on every render, adding it would cause an infinite reload loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser.user_id, reloadIndex]);

  const updateUser = (nextProfile) => {
    const nextUser = normalizeUser({ ...user, ...nextProfile });
    setUser(nextUser);
    setDashboard(nextUser);
    onUpdateSession(nextUser);
  };

  const openQuiz = (descriptor, returnPage = 'study') => {
    setQuizDescriptor(descriptor);
    setQuizReturnPage(returnPage);
    onPageChange('quiz');
  };

  const returnToStudy = () => {
    setQuizDescriptor(null);
    onPageChange(quizReturnPage);
  };

  // Only show the quiz title while actually on the quiz page — navigating via
  // sidebar should immediately show the correct page name.
  const pageTitle = (activePage === 'quiz' && quizDescriptor) ? quizDescriptor.title : NAVIGATION.find((item) => item.id === activePage)?.label;
  const currentProgress = progress || emptyProgress();

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <span>genro</span><b>AI</b>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {NAVIGATION.map((item) => <NavigationButton key={item.id} item={item} active={activePage === item.id} onClick={() => { setQuizDescriptor(null); onPageChange(item.id); }} />)}
        </nav>
        <div className="sidebar-footer">
          <div className="api-status"><span className={dataError ? 'status-dot warning' : 'status-dot'} />{dataError ? 'Connection needs attention' : 'Genro server connected'}</div>
          <button className="account-chip" onClick={() => onPageChange('profile')}>
            <span className="avatar avatar-small">{initials(user.full_name)}</span>
            <span><b>{user.full_name}</b><small>{user.class_level}</small></span>
            <ChevronRight size={15} />
          </button>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div>
            <span className="page-overline">GENRO LEARNING SPACE</span>
            <h1>{pageTitle || 'Your learning space'}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => setReloadIndex((value) => value + 1)} aria-label="Refresh your data" title="Refresh your data"><RefreshCw size={18} className={isLoading ? 'spin' : ''} /></button>
            <button className="profile-trigger" onClick={() => onPageChange('profile')} aria-label="Open profile"><span className="avatar">{initials(user.full_name)}</span><span className="profile-trigger-text"><b>{user.full_name.split(' ')[0]}</b><small>{user.class_level}</small></span><ChevronDown size={15} /></button>
          </div>
        </header>

        {dataError && activePage !== 'quiz' && <ConnectionBanner message={dataError} onRetry={() => setReloadIndex((value) => value + 1)} />}

        <main className="content-area">
          {activePage === 'home' && <OverviewPage user={user} dashboard={dashboard} progress={currentProgress} isLoading={isLoading} onNavigate={onPageChange} />}
          {activePage === 'study' && <StudyPage user={user} progress={currentProgress} onStartQuiz={openQuiz} />}
          {activePage === 'custom' && <CustomPracticePage user={user} onStartQuiz={(descriptor) => openQuiz(descriptor, 'custom')} />}
          {activePage === 'progress' && <ProgressPage user={user} progress={currentProgress} isLoading={isLoading} onNavigate={onPageChange} />}
          {activePage === 'tutor' && <TutorPage user={user} />}
          {activePage === 'profile' && <ProfilePage user={user} onUpdate={updateUser} onLogout={onLogout} />}
          {activePage === 'quiz' && <QuizPage user={user} descriptor={quizDescriptor} onBack={returnToStudy} onSavedProgress={() => setReloadIndex((value) => value + 1)} />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Main navigation">
        {NAVIGATION.map((item) => <NavigationButton key={item.id} item={item} active={activePage === item.id} onClick={() => { setQuizDescriptor(null); onPageChange(item.id); }} />)}
      </nav>
    </div>
  );
}

function NavigationButton({ item, active, onClick }) {
  const Icon = item.icon;
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}><Icon size={19} /><span>{item.label}</span></button>;
}

function OverviewPage({ user, dashboard, progress, isLoading, onNavigate }) {
  const summary = progress.summary || {};
  const totalTests = displayNumber(summary.total_tests);
  const topicsCovered = displayNumber(summary.topics_covered);
  const averageAccuracy = displayNumber(summary.avg_accuracy);
  const weakTopic = progress.weak_topics?.[0] || progress.all_progress?.[0];
  const recentTopics = progress.all_progress?.slice(0, 4) || [];
  const visibleSubjects = subjectsForTrack(user.study_track);

  return (
    <div className="page-stack overview-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> {user.class_level} · {user.board}</span>
          <h2>Good to see you, {user.full_name.split(' ')[0]}. <span>Ready for a focused session?</span></h2>
          <p>Choose a topic, follow your NCERT sequence, and let every attempt make your next study session clearer.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => onNavigate('study')}>Explore syllabus <ArrowRight size={17} /></button>
            <button className="secondary-button" onClick={() => onNavigate('tutor')}><MessageCircle size={16} /> Ask Genro AI</button>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" />
          <div className="orbit-core"><Sparkles size={29} /><span>GENRO<br />AI</span></div>
          <span className="orbit-chip chip-top"><Flame size={14} /> {displayNumber(dashboard.day_streak)} day streak</span>
          <span className="orbit-chip chip-bottom"><Zap size={14} /> {displayNumber(dashboard.total_xp)} XP</span>
        </div>
      </section>

      <section className="metric-grid" aria-label="Your learning summary">
        <MetricCard icon={Flame} label="Current streak" value={`${displayNumber(dashboard.day_streak)} days`} detail="Keep a little momentum each day" tone="orange" loading={isLoading} />
        <MetricCard icon={Zap} label="Total XP" value={displayNumber(dashboard.total_xp).toLocaleString('en-IN')} detail="Earned from completed practice" tone="violet" loading={isLoading} />
        <MetricCard icon={Target} label="Average accuracy" value={totalTests ? formatPercent(averageAccuracy) : '—'} detail={totalTests ? `Across ${totalTests} test${totalTests === 1 ? '' : 's'}` : 'Your first result will appear here'} tone="teal" loading={isLoading} />
        <MetricCard icon={BookMarked} label="Topics explored" value={topicsCovered || '—'} detail={topicsCovered ? 'Topics with recorded progress' : 'Start with your syllabus'} tone="rose" loading={isLoading} />
      </section>

      <section className="content-grid two-column">
        <article className="panel continue-panel">
          <div className="panel-heading"><div><span className="card-kicker">YOUR NEXT STEP</span><h3>{weakTopic ? 'A focused revision is waiting' : 'Start your first learning path'}</h3></div><span className="panel-icon violet"><Rocket size={19} /></span></div>
          {weakTopic ? (
            <div className="continue-content">
              <div className="topic-symbol">{subjectInitial(weakTopic.subject_name)}</div>
              <div className="continue-detail"><span>{weakTopic.subject_name || 'Study plan'} · {weakTopic.chapter_name || 'Revision'}</span><h4>{weakTopic.topic_name}</h4><p>{formatPercent(weakTopic.accuracy_percentage)} accuracy in {displayNumber(weakTopic.tests_attempted, 1)} recorded attempt{displayNumber(weakTopic.tests_attempted, 1) === 1 ? '' : 's'}.</p></div>
              <div className="continue-actions">
                <button className="secondary-button compact" onClick={() => onNavigate('study')}>Open topic <ArrowRight size={16} /></button>
                <a className="video-rec-link" href={videoRecommendationFor(weakTopic).url} target="_blank" rel="noreferrer"><PlayCircle size={13} /> {videoRecommendationFor(weakTopic).isCurated ? 'Watch explainer' : 'Find a video'}</a>
              </div>
            </div>
          ) : (
            <EmptyInline icon={BookOpen} title="Your plan is ready when you are" text="Choose Physics, Chemistry, or Biology and start following your class syllabus." actionLabel="Browse subjects" onAction={() => onNavigate('study')} />
          )}
        </article>

        <article className="panel goal-panel">
          <div className="panel-heading"><div><span className="card-kicker">STUDY RHYTHM</span><h3>Small steps add up</h3></div><span className="panel-icon orange"><Flame size={19} /></span></div>
          <div className="goal-stat"><strong>{displayNumber(dashboard.day_streak)}</strong><span>day streak</span></div>
          <p className="muted">A short, intentional session today keeps the habit alive. Your completed tests and XP update automatically from the API.</p>
          <button className="text-button" onClick={() => onNavigate('progress')}>See your progress <ArrowRight size={15} /></button>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">YOUR SUBJECTS</span><h3>Learn in the order that makes sense</h3></div><button className="text-button" onClick={() => onNavigate('study')}>View full syllabus <ArrowRight size={15} /></button></div>
        <div className="subject-grid">
          {visibleSubjects.map((subject) => {
            const Icon = subject.icon;
            const stats = getSubjectStats(progress.all_progress, subject.name);
            return <article className={`subject-card ${subject.accent}`} key={subject.name}>
              <span className="subject-icon"><Icon size={23} /></span>
              <div><span className="card-kicker">{user.class_level}</span><h4>{subject.name}</h4><p>{subject.description}</p></div>
              <div className="subject-card-footer"><span className="subject-accuracy" aria-label={`${subject.name} accuracy`}>{stats.attempts ? formatPercent(stats.accuracy) : '—'}</span><small>{stats.attempts ? `${stats.attempts} test${stats.attempts === 1 ? '' : 's'}` : 'Not started yet'}</small></div>
              <button className="card-link" onClick={() => onNavigate('study')}>Open syllabus <ArrowRight size={16} /></button>
            </article>;
          })}
        </div>
      </section>

      <section className="content-grid two-column bottom-space">
        <article className="panel progress-list-panel">
          <div className="panel-heading"><div><span className="card-kicker">RECENT ACTIVITY</span><h3>Your learning trail</h3></div><BarChart3 size={19} className="subtle-icon" /></div>
          {recentTopics.length ? <div className="activity-list">{recentTopics.map((item) => <ActivityRow key={item.progress_id || `${item.topic_id}-${item.last_tested_at}`} item={item} />)}</div> : <EmptyInline icon={TrendingUp} title="No activity recorded yet" text="Complete an available practice test to begin tracking your progress." />}
        </article>
        <article className="panel tutor-prompt-panel">
          <div className="tutor-mini-icon"><Bot size={24} /></div>
          <span className="card-kicker">GENRO AI TUTOR</span>
          <h3>Stuck on a concept?</h3>
          <p>Ask for a simple explanation, a revision plan, or help breaking down a difficult question.</p>
          <button className="primary-button" onClick={() => onNavigate('tutor')}>Start a conversation <ArrowRight size={17} /></button>
        </article>
      </section>
    </div>
  );
}

// COLD-START FIX: the backend (Render free tier) can take a while to wake up
// on its first request. A bare spinner with no explanation feels broken, so
// after a few seconds of waiting we surface the same reassuring notice the
// login screen already uses.
function useColdStartNotice(isLoading, delayMs = 4000) {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!isLoading) {
      setNotice('');
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      setNotice('This is taking longer than usual — the Genro server may be waking up. Hang tight, it should load in a moment.');
    }, delayMs);
    return () => window.clearTimeout(timeout);
  }, [isLoading, delayMs]);
  return notice;
}

function StudyPage({ user, progress, onStartQuiz }) {
  const [subject, setSubject] = useState('Physics');
  const [chapters, setChapters] = useState([]);
  const [openChapterId, setOpenChapterId] = useState(null);
  const [state, setState] = useState({ loading: true, error: '' });
  const availableSubjects = subjectsForTrack(user.study_track);
  const selectedSubject = availableSubjects.find((item) => item.name === subject) || availableSubjects[0];
  const subjectStats = getSubjectStats(progress.all_progress, selectedSubject?.name);
  const coldStartNotice = useColdStartNotice(state.loading);

  useEffect(() => {
    if (!availableSubjects.some((item) => item.name === subject)) {
      setSubject(availableSubjects[0]?.name || 'Physics');
    }
  }, [subject, availableSubjects]);

  // Warm the cache for every subject on this track as soon as Study opens, so
  // switching subjects afterwards doesn't wait on a fresh request.
  useEffect(() => {
    prefetchAllSubjects(user.class_level, user.study_track);
  }, [user.class_level, user.study_track]);

  useEffect(() => {
    let isCurrent = true;
    const subjectName = selectedSubject?.apiName || subject;
    setState({ loading: true, error: '' });
    setOpenChapterId(null);

    loadSyllabus(user.class_level, subjectName)
      .then((nextChapters) => {
        if (!isCurrent) return;
        setChapters(nextChapters);
        setState({ loading: false, error: '' });
      })
      .catch((requestError) => {
        if (!isCurrent) return;
        setChapters([]);
        setState({ loading: false, error: requestError.message });
      });

    return () => { isCurrent = false; };
  }, [subject, selectedSubject?.apiName, user.class_level]);

  const openChapter = chapters.find((chapter) => chapter.chapter_id === openChapterId) || null;

  return (
    <div className="page-stack study-page">
      <section className="study-header">
        <div><span className="eyebrow"><span className="eyebrow-dot" /> {user.class_level} SYLLABUS</span><h2>Build from the basics. Move with confidence.</h2><p>Choose a subject to see its chapter-and-topic sequence from the Genro API. Tap a chapter to see its topics — full chapter tests are ready to start right from the list.</p></div>
        <div className="study-badge"><BookOpen size={19} /><span><b>NCERT-aligned</b><small>Structured topic by topic</small></span></div>
      </section>

      <div className="subject-switcher" role="tablist" aria-label="Select a subject">
        {availableSubjects.map((item) => {
          const Icon = item.icon;
          const stats = getSubjectStats(progress.all_progress, item.name);
          return <button key={item.name} role="tab" aria-selected={subject === item.name} className={subject === item.name ? `active ${item.accent}` : ''} onClick={() => setSubject(item.name)}><Icon size={18} /><span>{item.name}</span><small>{stats.attempts ? formatPercent(stats.accuracy) : 'Not started'}</small></button>;
        })}
      </div>

      <p className="subject-status-copy">{subjectStats.attempts ? `${formatPercent(subjectStats.accuracy)} average accuracy across ${subjectStats.attempts} recorded test${subjectStats.attempts === 1 ? '' : 's'} in ${selectedSubject?.name}.` : `No completed ${selectedSubject?.name || subject} tests yet.`}</p>

      {state.loading ? <>{coldStartNotice && <InfoBanner message={coldStartNotice} />}<SyllabusSkeleton /></> : state.error ? <RequestState icon={XCircle} title="We couldn't load this syllabus" text={state.error} /> : chapters.length === 0 ? <RequestState icon={BookOpen} title="No chapters are available yet" text="The backend did not return any syllabus chapters for this class and subject." /> : openChapter ? (
        <ChapterDetailView chapter={openChapter} onBack={() => setOpenChapterId(null)} onStartQuiz={onStartQuiz} />
      ) : (
        <section className="chapter-list" aria-label={`${subject} chapters`}>
          {chapters.map((chapter) => <ChapterSummaryCard key={chapter.chapter_id} chapter={chapter} onOpen={() => setOpenChapterId(chapter.chapter_id)} onStartQuiz={onStartQuiz} />)}
        </section>
      )}
    </div>
  );
}

// A chapter row you tap to drill into its topics — the old design used an
// expanding accordion with a rotating chevron; this instead navigates into a
// dedicated chapter view (see ChapterDetailView) with a plain "open" arrow.
// The full chapter test button lives right here, outside/before the drill-in,
// so it's reachable without opening the chapter at all.
const ChapterSummaryCard = memo(function ChapterSummaryCard({ chapter, onOpen, onStartQuiz }) {
  const topicCount = chapter.topics?.length || 0;
  return <article className="chapter-card chapter-summary-card">
    <button className="chapter-open-row" onClick={onOpen}>
      <span className="chapter-number">{String(chapter.chapter_number).padStart(2, '0')}</span>
      <span className="chapter-title"><small>CHAPTER {chapter.chapter_number} · {topicCount} TOPIC{topicCount === 1 ? '' : 'S'}</small><b>{chapter.chapter_name}</b></span>
      <span className="chapter-actions"><ChevronRight size={19} /></span>
    </button>
    {chapter.has_chapter_test && <div className="chapter-summary-footer">
      <span className="available-pill">Full test ready</span>
      <button className="practice-button ready" onClick={() => onStartQuiz({ id: chapter.chapter_id, kind: 'chapter', title: `${chapter.chapter_name} · Full test`, chapter: chapter.chapter_name })}>Practice full test <ArrowRight size={15} /></button>
    </div>}
  </article>;
});

// The drill-in destination: back button, chapter header, then a flat list of
// topics (plus the full-chapter test again at the top, for convenience).
function ChapterDetailView({ chapter, onBack, onStartQuiz }) {
  const topicCount = chapter.topics?.length || 0;
  return <section className="chapter-detail">
    <button className="back-button chapter-detail-back" type="button" onClick={onBack}><ArrowLeft size={16} /> Back to chapters</button>
    <div className="chapter-detail-head">
      <span className="chapter-number">{String(chapter.chapter_number).padStart(2, '0')}</span>
      <div><small className="card-kicker">CHAPTER {chapter.chapter_number} · {topicCount} TOPIC{topicCount === 1 ? '' : 'S'}</small><h3>{chapter.chapter_name}</h3></div>
    </div>
    <div className="topic-list chapter-detail-topics">
      {chapter.has_chapter_test && <ChapterTestRow chapter={chapter} onStartQuiz={onStartQuiz} />}
      {chapter.topics?.map((topic, index) => <TopicRow key={topic.topic_id} topic={topic} index={index} chapter={chapter} onStartQuiz={onStartQuiz} />)}
      {!topicCount && <p className="empty-topic">Topics for this chapter will appear here soon.</p>}
    </div>
  </section>;
}

// Difficulty selection is switched off for now — Practice starts the test
// immediately and every available question in the file is included.
function ChapterTestRow({ chapter, onStartQuiz }) {
  return <div className="topic-row chapter-test-row">
    <span className="topic-order"><FileCheck size={15} /></span>
    <div className="topic-main"><b>Full chapter test</b><span>All topics from {chapter.chapter_name} combined</span></div>
    <div className="topic-actions">
      <button className="practice-button ready" onClick={() => onStartQuiz({ id: chapter.chapter_id, kind: 'chapter', title: `${chapter.chapter_name} · Full test`, chapter: chapter.chapter_name })}>Practice <ArrowRight size={15} /></button>
    </div>
  </div>;
}

const TopicRow = memo(function TopicRow({ topic, index, chapter, onStartQuiz }) {
  const canPractice = Boolean(topic.has_test);
  return <div className="topic-row">
    <span className="topic-order">{String(index + 1).padStart(2, '0')}</span>
    <div className="topic-main"><b>{topic.topic_name}</b><span>{topic.video_url ? 'Video lesson available' : canPractice ? 'Practice test available' : 'Practice set coming soon'}</span></div>
    <div className="topic-actions">
      {topic.video_url && <a className="round-action" href={topic.video_url} target="_blank" rel="noreferrer" title="Open video lesson"><PlayCircle size={17} /><span className="sr-only">Open video lesson</span></a>}
      <button className={canPractice ? 'practice-button ready' : 'practice-button'} disabled={!canPractice} onClick={() => onStartQuiz({ id: topic.topic_id, kind: 'topic', title: topic.topic_name, chapter: chapter.chapter_name })}>{canPractice ? <>Practice <ArrowRight size={15} /></> : 'Coming soon'}</button>
    </div>
  </div>;
});

// Custom Practice: student picks any mix of topics (across one subject) —
// QuizPage fetches each selected topic's file, combines every question into
// one pool, shuffles it, and hands back all of them (difficulty and question
// count are switched off for now, per the "give everything" request).
function CustomPracticePage({ user, onStartQuiz }) {
  const [subject, setSubject] = useState('Physics');
  const [chapters, setChapters] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });
  const [selectedTopics, setSelectedTopics] = useState(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const availableSubjects = subjectsForTrack(user.study_track);
  const selectedSubject = availableSubjects.find((item) => item.name === subject) || availableSubjects[0];
  const coldStartNotice = useColdStartNotice(state.loading);

  useEffect(() => {
    if (!availableSubjects.some((item) => item.name === subject)) {
      setSubject(availableSubjects[0]?.name || 'Physics');
    }
  }, [subject, availableSubjects]);

  useEffect(() => {
    prefetchAllSubjects(user.class_level, user.study_track);
  }, [user.class_level, user.study_track]);

  // Shares the same module-level cache as the Study page (see loadSyllabus),
  // so a subject already opened there loads instantly here too.
  useEffect(() => {
    let isCurrent = true;
    const subjectName = selectedSubject?.apiName || subject;
    setState({ loading: true, error: '' });

    loadSyllabus(user.class_level, subjectName)
      .then((nextChapters) => {
        if (!isCurrent) return;
        setChapters(nextChapters);
        setState({ loading: false, error: '' });
      })
      .catch((requestError) => {
        if (!isCurrent) return;
        setChapters([]);
        setState({ loading: false, error: requestError.message });
      });
    return () => { isCurrent = false; };
  }, [subject, selectedSubject?.apiName, user.class_level]);

  const toggleTopic = (topic) => {
    setSelectedTopics((current) => {
      const next = new Map(current);
      if (next.has(topic.topic_id)) next.delete(topic.topic_id);
      else next.set(topic.topic_id, topic.topic_name);
      return next;
    });
  };

  const toggleChapterAll = (chapter) => {
    const practicable = (chapter.topics || []).filter((topic) => topic.has_test);
    const allSelected = practicable.length > 0 && practicable.every((topic) => selectedTopics.has(topic.topic_id));
    setSelectedTopics((current) => {
      const next = new Map(current);
      practicable.forEach((topic) => {
        if (allSelected) next.delete(topic.topic_id);
        else next.set(topic.topic_id, topic.topic_name);
      });
      return next;
    });
  };

  const selectedCount = selectedTopics.size;
  const clearSelection = () => setSelectedTopics(new Map());

  // SEARCH FIX: with many chapters/topics, scrolling to find one specific
  // topic was tedious. Typing filters chapters down to just the matching
  // topics (or keeps a whole chapter's topics if the chapter name itself
  // matches), so a search like "taxon" jumps straight to what's relevant.
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const visibleChapters = !trimmedQuery ? chapters : chapters
    .map((chapter) => {
      const chapterMatches = chapter.chapter_name.toLowerCase().includes(trimmedQuery);
      const matchingTopics = (chapter.topics || []).filter((topic) => topic.topic_name.toLowerCase().includes(trimmedQuery));
      return { ...chapter, topics: chapterMatches ? chapter.topics : matchingTopics };
    })
    .filter((chapter) => (chapter.topics || []).length > 0);

  const startPractice = () => {
    const topicIds = [...selectedTopics.keys()];
    if (!topicIds.length) return;
    const difficultyLabel = difficulty === 'all' ? '' : ` · ${difficulty[0].toUpperCase()}${difficulty.slice(1)}`;
    onStartQuiz({
      id: `${topicIds.slice().sort((a, b) => a - b).join('-')}${difficulty !== 'all' ? `-${difficulty}` : ''}`,
      kind: 'custom',
      topics: topicIds,
      difficulty,
      subject: selectedSubject?.name || subject,
      title: `Custom Practice · ${topicIds.length} topic${topicIds.length === 1 ? '' : 's'}${difficultyLabel}`,
    });
  };

  return (
    <div className="page-stack custom-practice-page">
      <section className="study-header">
        <div><span className="eyebrow"><span className="eyebrow-dot" /> BUILD YOUR OWN SET</span><h2>Mix any topics into one test.</h2><p>Select any combination of topics from {selectedSubject?.name || subject} — the test is generated from every question across what you pick.</p></div>
        <div className="study-badge"><Sparkles size={19} /><span><b>Custom Practice</b><small>Your rules, your mix</small></span></div>
      </section>

      <div className="subject-switcher" role="tablist" aria-label="Select a subject">
        {availableSubjects.map((item) => {
          const Icon = item.icon;
          return <button key={item.name} role="tab" aria-selected={subject === item.name} className={subject === item.name ? `active ${item.accent}` : ''} onClick={() => setSubject(item.name)}><Icon size={18} /><span>{item.name}</span></button>;
        })}
      </div>

      <div className="custom-search-row">
        <div className="custom-search-box"><Search size={16} /><input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={`Search ${selectedSubject?.name || subject} topics…`} aria-label="Search topics" />{searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search"><X size={14} /></button>}</div>
        <div className="difficulty-selector" role="radiogroup" aria-label="Difficulty">
          {['all', 'easy', 'medium', 'tough'].map((level) => (
            <button key={level} type="button" role="radio" aria-checked={difficulty === level} className={difficulty === level ? 'active' : ''} onClick={() => setDifficulty(level)}>{level === 'all' ? 'All' : `${level[0].toUpperCase()}${level.slice(1)}`}</button>
          ))}
        </div>
      </div>

      {state.loading ? <>{coldStartNotice && <InfoBanner message={coldStartNotice} />}<SyllabusSkeleton /></> : state.error ? <RequestState icon={XCircle} title="We couldn't load this syllabus" text={state.error} /> : chapters.length === 0 ? <RequestState icon={BookOpen} title="No chapters are available yet" text="The backend did not return any syllabus chapters for this class and subject." /> : visibleChapters.length === 0 ? <RequestState icon={Search} title="No topics match your search" text={`Try a different word, or clear the search to see every ${selectedSubject?.name || subject} topic again.`} /> : (
        <section className="chapter-list" aria-label={`${subject} chapters for custom practice`}>
          {visibleChapters.map((chapter) => {
            const practicable = (chapter.topics || []).filter((topic) => topic.has_test);
            const chapterSelectedCount = practicable.filter((topic) => selectedTopics.has(topic.topic_id)).length;
            return <article className="chapter-card expanded" key={chapter.chapter_id}>
              <div className="chapter-toggle custom-chapter-head">
                <span className="chapter-number">{String(chapter.chapter_number).padStart(2, '0')}</span>
                <span className="chapter-title"><small>CHAPTER {chapter.chapter_number} · {practicable.length} PRACTICABLE</small><b>{chapter.chapter_name}</b></span>
                <div className="custom-chapter-actions">
                  {chapter.has_chapter_test && <button type="button" className="practice-button ready" onClick={() => onStartQuiz({ id: chapter.chapter_id, kind: 'chapter', title: `${chapter.chapter_name} · Full test`, chapter: chapter.chapter_name })}>Full test <ArrowRight size={15} /></button>}
                  <button type="button" className="text-button" disabled={!practicable.length} onClick={() => toggleChapterAll(chapter)}>{practicable.length && chapterSelectedCount === practicable.length ? 'Clear chapter' : 'Select all'}</button>
                </div>
              </div>
              <div className="topic-list custom-topic-list">
                {(chapter.topics || []).map((topic) => (
                  <label key={topic.topic_id} className={`custom-topic-row ${!topic.has_test ? 'disabled' : ''}`}>
                    <input type="checkbox" disabled={!topic.has_test} checked={selectedTopics.has(topic.topic_id)} onChange={() => toggleTopic(topic)} />
                    <span>{topic.topic_name}</span>
                    {!topic.has_test && <small>Coming soon</small>}
                  </label>
                ))}
                {!chapter.topics?.length && <p className="empty-topic">Topics for this chapter will appear here soon.</p>}
              </div>
            </article>;
          })}
        </section>
      )}

      <section className="panel custom-practice-builder">
        <div className="panel-heading"><div><span className="card-kicker">YOUR SET</span><h3>{selectedCount} topic{selectedCount === 1 ? '' : 's'} selected</h3></div>{selectedCount > 0 && <button type="button" className="text-button" onClick={clearSelection}>Clear all</button>}</div>
        <p className="muted custom-practice-hint">{selectedCount ? `Every ${difficulty === 'all' ? '' : `${difficulty} `}question from these ${selectedCount} topic${selectedCount === 1 ? '' : 's'} will be combined into one shuffled test.` : 'Tick topics above to build your mix.'}</p>
        <button className="primary-button custom-start-button" disabled={!selectedCount} onClick={startPractice}>Start custom practice <ArrowRight size={17} /></button>
      </section>
    </div>
  );
}

function ProgressPage({ user, progress, isLoading, onNavigate }) {
  const [reportAttemptId, setReportAttemptId] = useState(null);
  const summary = progress.summary || {};
  const totalTests = displayNumber(summary.total_tests);
  const avgAccuracy = displayNumber(summary.avg_accuracy);
  const strongTopics = progress.strong_topics || [];
  const weakTopics = progress.revision_required || progress.weak_topics || [];
  const testHistory = progress.test_history || [];
  const hasResponseData = progress.has_response_data;

  return <div className="page-stack progress-page">
    <section className="progress-hero">
      <div><span className="eyebrow"><span className="eyebrow-dot" /> LIVE LEARNING DATA</span><h2>Your progress has a pattern. Use it.</h2><p>Every completed topic test is saved to your Genro profile so you can see what needs reinforcement and what is becoming a strength.</p></div>
      <div className="accuracy-orb" style={{ '--accuracy': `${Math.min(100, Math.max(0, avgAccuracy))}%` }}><div><strong>{totalTests ? formatPercent(avgAccuracy) : '—'}</strong><span>average accuracy</span></div></div>
    </section>

    <section className="metric-grid progress-metrics">
      <MetricCard icon={Trophy} label="Tests attempted" value={totalTests} detail="Recorded by the backend" tone="violet" loading={isLoading} />
      <MetricCard icon={Target} label="Topics covered" value={displayNumber(summary.topics_covered)} detail="With saved progress" tone="teal" loading={isLoading} />
      <MetricCard icon={CheckCircle} label="Strong topics" value={strongTopics.length} detail="At 70% accuracy or above" tone="green" loading={isLoading} />
      <MetricCard icon={TrendingUp} label="Revision queue" value={weakTopics.length} detail="Marked revision required" tone="rose" loading={isLoading} />
    </section>

    {!totalTests ? <section className="panel empty-progress"><EmptyInline icon={BarChart3} title={hasResponseData ? 'Your progress story starts with one test' : 'Progress data is not available yet'} text={hasResponseData ? "Head to your syllabus, look for a topic marked Practice, and complete it. We'll take care of the tracking." : 'Refresh this page after the Genro server finishes loading your saved test attempts.'} actionLabel="Open syllabus" onAction={() => onNavigate('study')} /></section> : <>
      <section className="content-grid two-column">
        <TopicInsightPanel title="Revision queue" subtitle="Focus here next" icon={Target} tone="rose" topics={weakTopics} emptyText="Nothing urgent right now—nice work." showVideoHelp />
        <TopicInsightPanel title="Growing strengths" subtitle="Keep this momentum" icon={Trophy} tone="green" topics={strongTopics} emptyText="Your strongest topics will show here after a few tests." />
      </section>
      <section className="panel history-panel">
        <div className="panel-heading"><div><span className="card-kicker">TEST HISTORY</span><h3>Every recorded attempt, newest first</h3></div><span className="result-count">{testHistory.length} attempt{testHistory.length === 1 ? '' : 's'}</span></div>
        {testHistory.length ? <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Topic</th><th>Subject</th><th>Difficulty</th><th>Accuracy</th><th>Status</th><th>XP</th><th>Attempted</th><th /></tr></thead><tbody>{testHistory.map((item, index) => <tr key={item.attempt_id || item.progress_id || `${item.topic_id}-${item.last_tested_at}-${index}`}><td><b>{item.topic_name}</b><span>{item.chapter_name}</span></td><td>{item.subject_name}</td><td>{item.difficulty || '—'}</td><td><AccuracyBadge value={item.accuracy_percentage} /></td><td><span className={`status-pill ${statusTone(item.status)}`}>{item.status || 'Recorded'}</span></td><td>+{displayNumber(item.xp_earned)} XP</td><td>{formatDate(item.attempted_at || item.last_tested_at)}</td><td>{item.attempt_id && <button className="text-button" onClick={() => setReportAttemptId(item.attempt_id)}>View report</button>}</td></tr>)}</tbody></table></div> : <p className="muted empty-copy">Your earlier topic summaries are safe. Individual test attempts will appear here as you complete new practice sets.</p>}
      </section>
    </>}
    {reportAttemptId && <AttemptReportModal userId={user.user_id} attemptId={reportAttemptId} onClose={() => setReportAttemptId(null)} />}
  </div>;
}

// Progress page se kabhi bhi ek purani test ka poora question-by-question
// review dekhne ke liye — backend se attempt report fetch karke overlay mein dikhata hai.
function AttemptReportModal({ userId, attemptId, onClose }) {
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let isCurrent = true;
    setState({ loading: true, error: '', data: null });
    api.getAttemptReport(userId, attemptId)
      .then((response) => { if (isCurrent) setState({ loading: false, error: '', data: response.data }); })
      .catch((requestError) => { if (isCurrent) setState({ loading: false, error: requestError.message, data: null }); });
    return () => { isCurrent = false; };
  }, [userId, attemptId]);

  const reportData = state.data;
  const reportQuestions = reportData?.answers?.map((row, index) => ({
    id: row.question_number || index,
    text: row.question_text,
    options: normalizeOptions(row.options || []),
    correctAnswer: row.correct_key,
    topicName: row.topic_name || reportData?.topic_name || 'Practice topic',
  })) || [];
  const reportAnswers = Object.fromEntries((reportData?.answers || []).map((row, index) => [index, row.selected_key]));

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-panel report-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><span className="card-kicker">TEST REPORT</span><h3>{reportData?.topic_name || 'Practice test'}</h3><p className="muted">{reportData ? `${reportData.subject_name} · ${reportData.chapter_name} · ${reportData.difficulty || 'Medium'}` : ''}</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Close report"><X size={19} /></button>
        </div>
        {state.loading ? <LoaderLabel text="Loading your report" /> : state.error ? <AlertBanner message={state.error} /> : reportData?.has_detailed_answers ? <TestReportView questions={reportQuestions} answers={reportAnswers} /> : <p className="muted empty-copy">A question-by-question breakdown was not saved for this older attempt — only the summary score is available.</p>}
      </div>
    </div>
  );
}

function TutorPage({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [state, setState] = useState({ loading: true, sending: false, error: '' });
  const endRef = useRef(null);
  const cameraInputRef = useRef(null);
  const documentInputRef = useRef(null);

  useEffect(() => {
    let isCurrent = true;
    setState({ loading: true, sending: false, error: '' });
    api.getChat(user.user_id)
      .then((response) => {
        if (!isCurrent) return;
        setMessages((response.data || []).map(toChatMessage));
        setState({ loading: false, sending: false, error: '' });
      })
      .catch((requestError) => {
        if (!isCurrent) return;
        setState({ loading: false, sending: false, error: requestError.message });
      });
    return () => { isCurrent = false; };
  }, [user.user_id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, state.sending]);

  // DOCUMENT ATTACH FIX: the only way to attach anything used to be the
  // camera button, which forces the phone's live camera (capture="environment")
  // and only accepts images — there was no way to attach an existing photo
  // from the gallery or a PDF document, even though the backend has always
  // supported PDFs (see sanitizeChatAttachment in server.js). handleAttachment
  // now backs both the camera button and a separate document/gallery button.
  const handleAttachment = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      setState((current) => ({ ...current, error: 'Please choose a JPG, PNG, WebP photo or a PDF document.' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setState((current) => ({ ...current, error: 'Use a file smaller than 5 MB so it can be sent safely.' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({ dataUrl: String(reader.result), name: file.name || (isPdf ? 'document.pdf' : 'study-question.jpg'), isPdf });
      setState((current) => ({ ...current, error: '' }));
    };
    reader.onerror = () => setState((current) => ({ ...current, error: 'We could not read that file. Please try again.' }));
    reader.readAsDataURL(file);
  };

  const sendMessage = async (event) => {
    event?.preventDefault();
    const text = input.trim() || (attachment ? 'Please help me understand this image.' : '');
    if (!text || state.sending) return;

    const temporaryId = `local-${Date.now()}`;
    const pendingAttachment = attachment;
    setMessages((current) => [...current, { id: temporaryId, role: 'user', text, pending: true, attachmentPreview: pendingAttachment?.dataUrl, attachmentIsPdf: Boolean(pendingAttachment?.isPdf), attachmentName: pendingAttachment?.name }]);
    setInput('');
    setAttachment(null);
    setState((current) => ({ ...current, sending: true, error: '' }));

    try {
      const response = await api.sendChat(user.user_id, text, pendingAttachment ? { data_url: pendingAttachment.dataUrl, name: pendingAttachment.name } : undefined);
      const savedUser = response.data?.user_message;
      const aiReply = response.data?.ai_message;
      setMessages((current) => {
        const withoutTemporary = current.filter((message) => message.id !== temporaryId);
        return [
          ...withoutTemporary,
          savedUser ? toChatMessage(savedUser) : { id: temporaryId, role: 'user', text },
          ...(aiReply ? [toChatMessage(aiReply)] : []),
        ];
      });
      setState((current) => ({ ...current, sending: false }));
    } catch (requestError) {
      setMessages((current) => current.map((message) => message.id === temporaryId ? { ...message, pending: false, failed: true } : message));
      setState((current) => ({ ...current, sending: false, error: requestError.message }));
    }
  };

  const editMessage = async (message, messageText) => {
    try {
      setState((current) => ({ ...current, error: '' }));
      const response = await api.updateChat(user.user_id, message.id, messageText);
      const updatedUser = response.data?.user_message;
      const updatedAi = response.data?.ai_message;
      setMessages((current) => {
        const userIndex = current.findIndex((item) => item.id === message.id);
        if (userIndex < 0) return current;
        const before = current.slice(0, userIndex);
        const edited = updatedUser ? toChatMessage(updatedUser) : { ...current[userIndex], text: messageText };
        // The backend replaces the reply, so remove every old AI bubble that
        // belongs to this user message before inserting the fresh one.
        let afterIndex = userIndex + 1;
        while (afterIndex < current.length && current[afterIndex].role === 'ai') afterIndex += 1;
        return [...before, edited, ...(updatedAi ? [toChatMessage(updatedAi)] : []), ...current.slice(afterIndex)];
      });
      return true;
    } catch (requestError) {
      setState((current) => ({ ...current, error: requestError.message }));
      return false;
    }
  };

  const hasMessages = messages.length > 0;
  return <div className="tutor-page">
    <section className="tutor-header"><div className="tutor-avatar"><Bot size={23} /></div><div><span className="eyebrow"><span className="eyebrow-dot" /> GENRO AI TUTOR</span><h2>Ask it the way you would ask a teacher.</h2><p>Genro sends your question to the backend and saves the conversation to your study history.</p></div></section>
    <section className="chat-shell">
      <div className="chat-messages">
        {state.loading ? <div className="chat-loading"><LoaderLabel text="Loading your conversation" /></div> : state.error && !hasMessages ? <RequestState icon={XCircle} title="We couldn't open your chat history" text={state.error} /> : <>
          {!hasMessages && <WelcomeMessage name={user.full_name} />}
          {messages.map((message) => <ChatBubble message={message} key={message.id} onEdit={editMessage} />)}
          {state.sending && <div className="typing-indicator"><span /><span /><span /> Genro AI is thinking</div>}
        </>}
        <div ref={endRef} />
      </div>
      {!hasMessages && !state.loading && <div className="suggestion-row">{['Explain a difficult concept simply', 'Help me plan a 30-minute revision session', 'Give me a NEET-style practice strategy'].map((prompt) => <button key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>)}</div>}
      {state.error && hasMessages && <AlertBanner message={state.error} compact />}
      {attachment && <div className="chat-attachment-preview">{attachment.isPdf ? <span className="file-chip"><FileText size={18} /></span> : <img src={attachment.dataUrl} alt="Selected study question" />}<span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove selected attachment"><X size={15} /></button></div>}
      <form className="chat-composer" onSubmit={sendMessage}>
        <input ref={cameraInputRef} className="sr-only" type="file" accept="image/*" onChange={handleAttachment} />
        <input ref={documentInputRef} className="sr-only" type="file" accept="image/*,application/pdf" onChange={handleAttachment} />
        <button className="camera-button" type="button" onClick={() => cameraInputRef.current?.click()} aria-label="Take or choose a photo of a question" title="Take or choose a photo"><Camera size={18} /></button>
        <button className="attach-button" type="button" onClick={() => documentInputRef.current?.click()} aria-label="Attach a photo or PDF document" title="Attach a photo or document"><Paperclip size={18} /></button>
        <textarea rows="1" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Ask a study question…" aria-label="Message Genro AI" />
        <button className="send-button" type="submit" disabled={(!input.trim() && !attachment) || state.sending} aria-label="Send message"><Send size={18} /></button>
      </form>
      <p className="chat-footnote">Camera for a quick photo · Paperclip to attach a photo or PDF · Enter to send · Shift + Enter for a new line</p>
    </section>
  </div>;
}

function ProfilePage({ user, onUpdate, onLogout }) {
  const [form, setForm] = useState(user);
  const [state, setState] = useState({ saving: false, error: '', success: '' });

  useEffect(() => { setForm(user); }, [user]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setState({ saving: true, error: '', success: '' });
    try {
      const response = await api.updateProfile(user.user_id, {
        full_name: form.full_name.trim(),
        class_level: form.class_level,
        board: form.board,
        study_track: form.study_track,
      });
      onUpdate(response.data || form);
      setState({ saving: false, error: '', success: 'Your profile has been saved.' });
    } catch (requestError) {
      setState({ saving: false, error: requestError.message, success: '' });
    }
  };

  return <div className="page-stack profile-page">
    <section className="profile-hero"><span className="avatar profile-avatar">{initials(user.full_name)}</span><div><span className="eyebrow"><span className="eyebrow-dot" /> YOUR GENRO ACCOUNT</span><h2>{user.full_name}</h2><p>{user.class_level} · {user.board} · {user.email}</p></div><div className="profile-xp"><Zap size={18} /><strong>{displayNumber(user.total_xp)}</strong><span>XP earned</span></div></section>
    <section className="profile-layout">
      <form className="panel profile-form" onSubmit={saveProfile}>
        <div className="panel-heading"><div><span className="card-kicker">PERSONAL DETAILS</span><h3>Keep your learning profile current</h3></div><Edit3 size={19} className="subtle-icon" /></div>
        {state.error && <AlertBanner message={state.error} />}{state.success && <SuccessBanner message={state.success} />}
        <div className="form-grid two"><FormField icon={User} label="Full name" htmlFor="profile-name"><input id="profile-name" name="full_name" value={form.full_name || ''} onChange={updateField} required /></FormField><FormField icon={Mail} label="Email address" htmlFor="profile-email"><input className="readonly-input" id="profile-email" name="email" type="email" value={form.email || ''} readOnly aria-readonly="true" /></FormField></div>
        <div className="form-grid two"><FormField icon={Phone} label="Mobile number" htmlFor="profile-mobile"><input className="readonly-input" id="profile-mobile" name="mobile_no" inputMode="numeric" value={form.mobile_no || ''} readOnly aria-readonly="true" /></FormField><FormField icon={BookMarked} label="Class" htmlFor="profile-class"><select id="profile-class" name="class_level" value={form.class_level || 'CLASS 12'} onChange={updateField}><option>CLASS 11</option><option>CLASS 12</option></select></FormField></div>
        <FormField icon={Award} label="Board" htmlFor="profile-board"><select id="profile-board" name="board" value={form.board || 'CBSE'} onChange={updateField}><option>CBSE</option><option>ISC</option><option>State Board</option></select></FormField>
        <TrackPicker value={form.study_track} onChange={(study_track) => setForm((current) => ({ ...current, study_track }))} compact />
        <p className="identity-lock-note">Email and mobile are your verified sign-in details, so they can’t be changed here.</p>
        <button className="primary-button profile-save" disabled={state.saving} type="submit">{state.saving ? <LoaderLabel text="Saving changes" /> : <><Check size={17} /> Save changes</>}</button>
      </form>
      <aside className="profile-side-stack">
        <article className="panel account-summary"><span className="panel-icon teal"><Trophy size={19} /></span><span className="card-kicker">LEARNING SNAPSHOT</span><strong>{displayNumber(user.day_streak)} day streak</strong><p>Small, regular sessions are the most reliable way to build recall.</p></article>
        <article className="panel api-card"><span className="card-kicker">API CONNECTION</span><h3>Connected learning data</h3><p>This interface is connected to your configured Genro backend.</p><code>{API_BASE_URL}</code></article>
        <button className="logout-button" onClick={onLogout}><LogOut size={17} /> Sign out of Genro</button>
      </aside>
    </section>
  </div>;
}

function QuizPage({ user, descriptor, onBack, onSavedProgress }) {
  const [questions, setQuestions] = useState([]);
  const [state, setState] = useState({ loading: true, error: '', submitted: false, saving: false, saveError: '' });
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    if (!descriptor?.id) {
      setState({ loading: false, error: 'Choose a topic from the syllabus before starting a practice test.', submitted: false, saving: false, saveError: '' });
      return undefined;
    }
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setElapsedSeconds(0);
    setState({ loading: true, error: '', submitted: false, saving: false, saveError: '' });

    // CUSTOM PRACTICE FIX: this used to fetch only the first selected topic
    // (it called the single-topic test route with just descriptor.id) and
    // silently ignored the rest of the student's mix. It now fetches every
    // selected topic's question file and merges them into one pool, filtered
    // by the difficulty chosen on the Custom Practice screen (if any).
    const loadQuestions = descriptor.kind === 'custom'
      ? api.getCustomTest(descriptor.topics || [], descriptor.difficulty || 'all')
          .then((response) => normalizeQuestions(response.data?.questions || [], descriptor.difficulty))
      : api.getTest(descriptor.id, descriptor.kind)
          .then(async (response) => {
            const url = response.data?.test_json_url;
            if (!url) throw new Error('A practice set is not available for this yet.');
            const payload = await fetchQuizPayload(url);
            return normalizeQuestions(payload);
          });

    loadQuestions
      .then((rawQuestions) => {
        const normalizedQuestions = shuffleArray(rawQuestions).slice(0, 20);
        if (!normalizedQuestions.length) throw new Error('This practice set does not contain usable multiple-choice questions yet.');
        if (!isCurrent) return;
        setQuestions(normalizedQuestions);
        setState({ loading: false, error: '', submitted: false, saving: false, saveError: '' });
      })
      .catch((requestError) => {
        if (!isCurrent) return;
        setState({ loading: false, error: requestError.message, submitted: false, saving: false, saveError: '' });
      });
    return () => { isCurrent = false; };
  }, [descriptor?.id, descriptor?.kind, descriptor?.difficulty]);

  useEffect(() => {
    if (state.loading || state.submitted || !questions.length) return undefined;
    const interval = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(interval);
  }, [state.loading, state.submitted, questions.length]);

  const score = useMemo(() => questions.reduce((count, question, index) => (
    isCorrectAnswer(answers[index], question.correctAnswer) ? count + 1 : count
  ), 0), [answers, questions]);
  const answeredCount = Object.keys(answers).length;
  const accuracy = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  const [savedAttemptId, setSavedAttemptId] = useState(null);
  const chooseAnswer = useCallback((key) => setAnswers((current) => ({ ...current, [currentIndex]: key })), [currentIndex]);
  const skipQuestion = () => {
    setAnswers((current) => {
      const next = { ...current };
      delete next[currentIndex];
      return next;
    });
    if (isLastQuestion) submitQuiz();
    else setCurrentIndex((index) => index + 1);
  };
  const submitQuiz = async () => {
    setState((current) => ({ ...current, submitted: true, saving: true, saveError: '' }));
    try {
      // Detailed report ke liye har question ka apna answer + sahi answer bhi
      // bhej rahe hain, taaki baad mein Progress page se dobara review kiya ja sake.
      const answerDetails = questions.map((question, index) => ({
        question_text: question.text,
        topic_name: question.topicName || '',
        options: question.options,
        selected_key: answers[index] || null,
        correct_key: question.correctAnswer || null,
        is_correct: isCorrectAnswer(answers[index], question.correctAnswer),
      }));
      // PROGRESS FIX: chapter and custom tests now save too — previously
      // only topic tests reached the backend, so the rest never counted.
      const basePayload = {
        status: accuracy >= 70 ? 'Mastered' : 'Revision Required',
        accuracy_percentage: accuracy,
        xp_earned: Math.max(10, score * 10),
        difficulty: descriptor.difficulty || 'Medium',
        answers: answerDetails,
      };
      const payload = descriptor.kind === 'chapter'
        ? { ...basePayload, chapter_id: descriptor.id, label: descriptor.title }
        : descriptor.kind === 'custom'
          ? { ...basePayload, topic_ids: descriptor.topics, label: descriptor.title }
          : { ...basePayload, topic_id: descriptor.id };
      const response = await api.saveProgress(user.user_id, payload);
      setSavedAttemptId(response?.data?.attempt_id || null);
      setState((current) => ({ ...current, saving: false }));
      onSavedProgress();
    } catch (requestError) {
      setState((current) => ({ ...current, saving: false, saveError: requestError.message }));
    }
  };

  if (state.loading) return <div className="quiz-state"><LoaderLabel text="Loading your practice set" /></div>;
  if (state.error) return <div className="quiz-state"><RequestState icon={BookOpen} title="Practice is not ready yet" text={state.error} actionLabel="Back to syllabus" onAction={onBack} /></div>;
  if (!currentQuestion) return null;

  if (state.submitted) {
    return <QuizResults descriptor={descriptor} questions={questions} answers={answers} score={score} accuracy={accuracy} elapsedSeconds={elapsedSeconds} state={state} onBack={onBack} attemptId={savedAttemptId} />;
  }

  return <div className="quiz-page">
    <div className="quiz-topline"><button className="quiz-exit-button" onClick={onBack}><ArrowLeft size={16} /> Leave practice</button><span><Clock size={16} /> {formatElapsedTime(elapsedSeconds)}</span></div>
    <section className="quiz-card">
      <div className="quiz-heading"><div><span className="eyebrow">LIVE PRACTICE · {descriptor.chapter || 'TOPIC TEST'}</span><h2>{descriptor.title}</h2></div><span className="question-count">{currentIndex + 1} <small>/ {questions.length}</small></span></div>
      <div className="question-progress"><span style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} /></div>
      <div className="question-nav" aria-label="Question palette">{questions.map((question, index) => <button key={question.id || index} className={`${currentIndex === index ? 'current' : ''} ${answers[index] ? 'answered' : ''}`} onClick={() => setCurrentIndex(index)}>{index + 1}</button>)}</div>
      <div className="question-body">
        <div className="question-body-head"><span className="question-label">QUESTION {currentIndex + 1}</span><button type="button" className="skip-button" onClick={skipQuestion}>{isLastQuestion ? 'Skip & submit' : 'Skip question'} <ArrowRight size={13} /></button></div>
        <h3>{cleanMathText(currentQuestion.text)}</h3>
        <div className="answers-list">{currentQuestion.options.map((option) => <button key={option.key} className={answers[currentIndex] === option.key ? 'selected' : ''} onClick={() => chooseAnswer(option.key)}><span>{option.key}</span><p>{cleanMathText(option.text)}</p><i>{answers[currentIndex] === option.key && <Check size={15} />}</i></button>)}</div>
      </div>
      <div className="quiz-actions"><button className="secondary-button" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0}><ArrowLeft size={16} /> Previous</button><span>{answeredCount} of {questions.length} answered</span><button className="primary-button" onClick={() => isLastQuestion ? submitQuiz() : setCurrentIndex((index) => index + 1)}>{isLastQuestion ? 'Submit practice' : <>Next question <ArrowRight size={16} /></>}</button></div>
    </section>
  </div>;
}

function QuizResults({ descriptor, questions, answers, score, accuracy, elapsedSeconds, state, onBack }) {
  const unanswered = questions.length - Object.keys(answers).length;
  const [showReport, setShowReport] = useState(true);
  const savingLabel = state.saving ? 'Saving your test result…' : state.saveError ? 'Result saved locally only' : 'Your result is in your progress history';
  const avgSecondsPerQuestion = questions.length ? Math.round(elapsedSeconds / questions.length) : 0;
  const performanceTone = accuracy >= 70 ? 'high' : accuracy >= 40 ? 'medium' : 'low';
  return <div className="quiz-results">
    <section className="result-hero">
      <div className="accuracy-ring" style={{ '--pct': Math.max(0, Math.min(100, accuracy)) }}><span>{accuracy}<small>%</small></span></div>
      <div className="result-hero-copy">
        <span className="eyebrow">PRACTICE COMPLETE</span>
        <h2>{accuracy >= 70 ? 'That was a strong effort.' : accuracy >= 40 ? 'Good progress — a bit more practice will help.' : 'Every result gives you a better next step.'}</h2>
        <p>{descriptor.title} · {questions.length} questions · {formatElapsedTime(elapsedSeconds)}</p>
      </div>
    </section>
    <section className="result-grid">
      <article><span className="card-kicker">SCORE</span><strong>{score}<small> / {questions.length}</small></strong></article>
      <article><span className="card-kicker">ACCURACY</span><strong className={`tone-${performanceTone}`}>{accuracy}<small>%</small></strong></article>
      <article><span className="card-kicker">UNANSWERED</span><strong>{unanswered}</strong></article>
      <article><span className="card-kicker">TIME PER QUESTION</span><strong>{formatPaceLabel(avgSecondsPerQuestion)}</strong></article>
    </section>
    <section className="panel result-summary"><div className="panel-heading"><div><span className="card-kicker">SAVED PROGRESS</span><h3>{savingLabel}</h3></div><span className="panel-icon teal"><CheckCircle size={19} /></span></div>{!state.saving && !state.saveError && <p className="success-copy"><Check size={15} /> Accuracy and XP were sent to the Genro backend.</p>}{state.saveError && <AlertBanner message={`We could not save this result: ${state.saveError}`} compact />}
      <div className="result-summary-actions">
        <button className="secondary-button" type="button" onClick={() => setShowReport((value) => !value)}>{showReport ? 'Hide' : 'View'} detailed report <ChevronDown size={16} className={showReport ? 'chevron-flip' : ''} /></button>
        <button className="primary-button" onClick={onBack}>Back to syllabus <ArrowRight size={17} /></button>
      </div>
    </section>
    {showReport && <TestReportView questions={questions} answers={answers} />}
  </div>;
}

// Question-by-question breakdown: kya poocha gaya, student ne kya select
// kiya, aur sahi jawab kya tha. Fresh attempt ke turant baad local state se
// aata hai; purane attempts ke liye ProgressPage isi component ko backend se
// laayi gayi report ke saath use karta hai. Ab ek summary strip aur
// correct/wrong/skipped filter ke saath — poori list mein scroll karne ki
// zaroorat nahi, seedha apni galtiyon par jump kar sakte hain.
const REPORT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'wrong', label: 'Incorrect' },
  { key: 'skipped', label: 'Skipped' },
];

function TestReportView({ questions, answers }) {
  const [filter, setFilter] = useState('all');
  const tagged = useMemo(() => questions.map((question, index) => {
    const selected = answers[index] || null;
    const correct = question.correctAnswer || null;
    const isRight = isCorrectAnswer(selected, correct);
    const tone = selected ? (isRight ? 'correct' : 'wrong') : 'skipped';
    return { question, index, selected, correct, isRight, tone };
  }), [questions, answers]);
  const counts = tagged.reduce((totals, item) => ({ ...totals, [item.tone]: (totals[item.tone] || 0) + 1 }), { correct: 0, wrong: 0, skipped: 0 });
  const visible = filter === 'all' ? tagged : tagged.filter((item) => item.tone === filter);
  const topicPerformance = useMemo(() => {
    const groups = new Map();
    tagged.forEach((item) => {
      const name = item.question.topicName || item.question.topic_name || item.question.topic || item.question.section || 'Practice topic';
      const group = groups.get(name) || { topic_name: name, correct: 0, total: 0 };
      group.total += 1;
      if (item.isRight) group.correct += 1;
      groups.set(name, group);
    });
    return [...groups.values()].map((item) => ({ ...item, accuracy: Math.round((item.correct / item.total) * 100) }));
  }, [tagged]);
  const weakTopics = topicPerformance.filter((item) => item.accuracy < 70);
  const strongTopics = topicPerformance.filter((item) => item.accuracy >= 70);

  return <section className="panel test-report">
    <div className="panel-heading"><div><span className="card-kicker">DETAILED REPORT</span><h3>Question-by-question review</h3></div><span className="panel-icon violet"><BookOpen size={19} /></span></div>
    <div className="report-breakdown-bar" role="img" aria-label={`${counts.correct} correct, ${counts.wrong} incorrect, ${counts.skipped} skipped out of ${questions.length} questions`}>
      {counts.correct > 0 && <span className="correct" style={{ width: `${(counts.correct / questions.length) * 100}%` }} />}
      {counts.wrong > 0 && <span className="wrong" style={{ width: `${(counts.wrong / questions.length) * 100}%` }} />}
      {counts.skipped > 0 && <span className="skipped" style={{ width: `${(counts.skipped / questions.length) * 100}%` }} />}
    </div>
    <div className="report-summary-strip">
      <div className="report-summary-stat correct"><strong>{counts.correct}</strong><span>Correct</span></div>
      <div className="report-summary-stat wrong"><strong>{counts.wrong}</strong><span>Incorrect</span></div>
      <div className="report-summary-stat skipped"><strong>{counts.skipped}</strong><span>Skipped</span></div>
    </div>
    <div className="report-topic-insights">
      <div><b>Strong topics</b>{strongTopics.length ? strongTopics.map((topic) => <span key={topic.topic_name}>{topic.topic_name} · {topic.accuracy}%</span>) : <span>Keep practising to identify strengths.</span>}</div>
      <div className="weak-topic-report"><b>Weak topics</b>{weakTopics.length ? weakTopics.map((topic) => <span key={topic.topic_name}><em>{topic.topic_name} · {topic.accuracy}%</em><a className="video-rec-link" href={videoRecommendationFor(topic).url} target="_blank" rel="noreferrer"><PlayCircle size={13} /> Play video</a></span>) : <span>No weak topics in this attempt.</span>}</div>
    </div>
    <div className="report-filter-row" role="tablist" aria-label="Filter questions">
      {REPORT_FILTERS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>{item.label}{item.key !== 'all' ? ` (${counts[item.key] || 0})` : ''}</button>)}
    </div>
    <div className="report-list">
      {visible.length === 0 && <p className="muted empty-copy">Nothing here — nice work.</p>}
      {visible.map(({ question, index, selected, correct, isRight, tone }) => (
        <article className={`report-item ${tone}`} key={question.id || index}>
          <div className="report-item-head"><span className="report-q-number">Q{index + 1}</span><span className={`report-status-pill ${tone}`}>{selected ? (isRight ? <><Check size={13} /> Correct</> : <><X size={13} /> Incorrect</>) : 'Not answered'}</span></div>
          <p className="report-question-text">{cleanMathText(question.text)}</p>
          <div className="report-options">
            {question.options.map((option) => {
              const isSelected = selected === option.key;
              const isCorrectOption = correct === option.key;
              return <div key={option.key} className={`report-option ${isCorrectOption ? 'is-correct' : ''} ${isSelected && !isCorrectOption ? 'is-selected-wrong' : ''}`}><span>{option.key}</span><p>{cleanMathText(option.text)}</p>{isCorrectOption && <Check size={14} />}{isSelected && !isCorrectOption && <X size={14} />}</div>;
            })}
          </div>
        </article>
      ))}
    </div>
  </section>;
}

function MetricCard({ icon: Icon, label, value, detail, tone, loading }) {
  return <article className={`metric-card ${tone}`}><span className="metric-icon"><Icon size={19} /></span><div><span>{label}</span>{loading ? <span className="metric-skeleton" /> : <strong>{value}</strong>}<small>{detail}</small></div></article>;
}

// WEAK TOPIC FIX: the backend has always sent back a topic's video_url (see
// the JOIN in /api/user/:user_id/progress), but nothing in the UI used it —
// weak topics were listed with no way to act on them. This builds a
// recommendation link for each weak topic: the content team's own curated
// video if one is set on that topic, otherwise a YouTube search built from
// the topic + subject + class, so a recommendation is always available.
function videoRecommendationFor(topic) {
  if (topic.video_url) return { url: topic.video_url, isCurated: true };
  const query = [topic.topic_name, topic.chapter_name, topic.subject_name, 'concept explained'].filter(Boolean).join(' ');
  return { url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, isCurated: false };
}

function TopicInsightPanel({ title, subtitle, icon: Icon, tone, topics, emptyText, showVideoHelp = false }) {
  return <article className={`panel topic-insight ${tone}`}><div className="panel-heading"><div><span className="card-kicker">{subtitle}</span><h3>{title}</h3></div><span className={`panel-icon ${tone}`}><Icon size={19} /></span></div>{topics.length ? <div className="insight-list">{topics.slice(0, 4).map((topic) => {
    const video = showVideoHelp ? videoRecommendationFor(topic) : null;
    return <div className="insight-item" key={topic.progress_id || topic.topic_id}>
      <div><b>{topic.topic_name}</b><span>{topic.subject_name} · {topic.chapter_name}</span></div>
      <div className="insight-item-side"><AccuracyBadge value={topic.accuracy_percentage} />{video && <a className="video-rec-link" href={video.url} target="_blank" rel="noreferrer"><PlayCircle size={13} /> {video.isCurated ? 'Watch explainer' : 'Find a video'}</a>}</div>
    </div>;
  })}</div> : <p className="muted empty-copy">{emptyText}</p>}</article>;
}

function ActivityRow({ item }) {
  return <div className="activity-row"><span className={`activity-status ${statusTone(item.status)}`}><CheckCircle size={15} /></span><div><b>{item.topic_name}</b><span>{item.subject_name} · {item.chapter_name}</span></div><div className="activity-meta"><AccuracyBadge value={item.accuracy_percentage} /><small>{formatDate(item.last_tested_at)}</small></div></div>;
}

function AccuracyBadge({ value }) {
  const numericValue = displayNumber(value);
  return <span className={`accuracy-badge ${numericValue >= 70 ? 'high' : numericValue < 50 ? 'low' : 'medium'}`}>{formatPercent(numericValue)}</span>;
}

function FormField({ icon: Icon, label, htmlFor, children }) {
  return <label className="form-field" htmlFor={htmlFor}><span><Icon size={15} /> {label}</span>{children}</label>;
}

function TrackPicker({ value, onChange, compact = false }) {
  return <fieldset className={`track-picker ${compact ? 'compact' : ''}`}>
    <legend><BookMarked size={15} /> Preparation track</legend>
    <label className={value === 'Medical' ? 'selected' : ''}>
      <input type="radio" name="study-track" value="Medical" checked={value === 'Medical'} onChange={() => onChange('Medical')} />
      <span><b>Medical</b><small>NEET · Physics, Chemistry, Biology</small></span>
    </label>
    <label className={value === 'Non-Medical' ? 'selected' : ''}>
      <input type="radio" name="study-track" value="Non-Medical" checked={value === 'Non-Medical'} onChange={() => onChange('Non-Medical')} />
      <span><b>Non-Medical</b><small>JEE · Physics, Chemistry, Mathematics</small></span>
    </label>
  </fieldset>;
}

function AlertBanner({ message, compact = false }) {
  return <div className={`alert-banner ${compact ? 'compact' : ''}`} role="alert"><XCircle size={compact ? 15 : 17} /><span>{message}</span></div>;
}

function SuccessBanner({ message }) {
  return <div className="success-banner" role="status"><CheckCircle size={17} /><span>{message}</span></div>;
}

function InfoBanner({ message }) {
  return <div className="info-banner" role="status"><Clock size={17} /><span>{message}</span></div>;
}

function ConnectionBanner({ message, onRetry }) {
  return <div className="connection-banner"><XCircle size={17} /><span>{message}</span><button onClick={onRetry}><RefreshCw size={14} /> Retry</button></div>;
}

function LoaderLabel({ text }) {
  return <span className="loader-label"><RefreshCw size={16} className="spin" /> {text}</span>;
}

function EmptyInline({ icon: Icon, title, text, actionLabel, onAction }) {
  return <div className="empty-inline"><span><Icon size={19} /></span><div><b>{title}</b><p>{text}</p>{actionLabel && <button className="text-button" onClick={onAction}>{actionLabel} <ArrowRight size={14} /></button>}</div></div>;
}

function RequestState({ icon: Icon, title, text, actionLabel, onAction }) {
  return <section className="request-state"><span><Icon size={28} /></span><h3>{title}</h3><p>{text}</p>{actionLabel && <button className="primary-button" onClick={onAction}>{actionLabel} <ArrowRight size={16} /></button>}</section>;
}

function SyllabusSkeleton() {
  return <div className="chapter-list skeleton-list">{Array.from({ length: 5 }).map((_, index) => <div className="chapter-skeleton" key={index}><span /><div><i /><b /></div><em /></div>)}</div>;
}

function WelcomeMessage({ name }) {
  return <div className="welcome-message"><span className="chat-bot-icon"><Bot size={20} /></span><div><span className="card-kicker">GENRO AI</span><h3>Hi {name.split(' ')[0]}, what are we working through today?</h3><p>I can explain a concept, help you structure revision, or break a difficult question into simpler steps.</p></div></div>;
}

function ChatBubble({ message, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  // Delete was removed from the UI on purpose — messages can still be edited,
  // but not removed from history.
  const canManage = message.role === 'user' && !message.pending && !message.failed && !String(message.id).startsWith('local-');
  const hasAttachment = Boolean(message.attachmentPreview || message.attachmentUrl);

  useEffect(() => { setDraft(message.text); }, [message.text]);

  const saveEdit = async () => {
    const nextText = draft.trim();
    if (!nextText || nextText === message.text) {
      setEditing(false);
      return;
    }
    const wasSaved = await onEdit(message, nextText);
    if (wasSaved) setEditing(false);
  };

  return <div className={`chat-bubble-row ${message.role === 'user' ? 'from-user' : 'from-ai'}`}><span className="chat-message-avatar">{message.role === 'user' ? <User size={15} /> : <Bot size={15} />}</span><div className={`chat-bubble ${message.pending ? 'pending' : ''} ${message.failed ? 'failed' : ''}`}>
    {editing ? <div className="chat-edit-form"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows="2" aria-label="Edit your message" /><div><button type="button" onClick={() => { setDraft(message.text); setEditing(false); }}>Cancel</button><button type="button" onClick={saveEdit} disabled={!draft.trim()}>Save</button></div></div> : <><p>{message.text}</p>{hasAttachment && (message.attachmentIsPdf ? <a className="chat-attachment-file" href={message.attachmentPreview || `${API_BASE_URL}${message.attachmentUrl}`} target="_blank" rel="noreferrer"><FileText size={15} /><span>{message.attachmentName || 'Document.pdf'}</span></a> : <img className="chat-attachment" src={message.attachmentPreview || `${API_BASE_URL}${message.attachmentUrl}`} alt="Attached study question" />)}</>}
    {message.failed && <small>Not sent. Please try again.</small>}
    {canManage && !editing && <div className="chat-message-controls"><button type="button" onClick={() => setEditing(true)} aria-label="Edit message" title="Edit message"><Pencil size={13} /></button></div>}
  </div></div>;
}

function toChatMessage(message) {
  return {
    id: message.message_id || `${message.sender_type}-${message.created_at}-${message.message_text}`,
    role: message.sender_type === 'User' ? 'user' : 'ai',
    text: message.message_text,
    attachmentUrl: message.attachment_url || null,
    attachmentIsPdf: message.attachment_mime === 'application/pdf',
  };
}

function emptyProgress() {
  return { summary: { total_tests: 0, avg_accuracy: 0, topics_covered: 0 }, strong_topics: [], weak_topics: [], revision_required: [], all_progress: [], test_history: [], has_response_data: false };
}

function subjectInitial(subject) {
  return ({ Physics: 'P', Chemistry: 'C', Biology: 'B', Mathematics: 'M' })[canonicalSubject(subject)] || 'G';
}

function statusTone(status) {
  return status === 'Mastered' ? 'high' : status === 'Revision Required' ? 'low' : 'medium';
}

function formatElapsedTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// "Avg. pace" used to just show a bare number with no unit context ("42"),
// which read as unclear. This spells out what it means: seconds per question
// under a minute, minutes:seconds once it's slower than that.
function formatPaceLabel(avgSecondsPerQuestion) {
  if (avgSecondsPerQuestion < 60) return `${avgSecondsPerQuestion}s / question`;
  return `${formatElapsedTime(avgSecondsPerQuestion)} / question`;
}

// Different content creators structure their chapter JSON files differently.
// Some (e.g. chemical_kinetics.json) give one flat "questions" array where
// each question carries its own difficulty field. Others (e.g.
// gravitation.json) nest the whole chapter under Easy / Medium / Hard keys,
// each holding topic-grouped question lists. findDifficultyBranch() detects
// the second shape anywhere in the payload and returns just the branch that
// matches the difficulty the student picked, so we never mix all three
// difficulties into one quiz.
function canonicalDifficulty(value) {
  const label = String(value || '').toLowerCase().trim();
  if (['hard', 'tough', 'difficult', 'advanced'].includes(label)) return 'hard';
  if (['medium', 'moderate'].includes(label)) return 'medium';
  if (['easy', 'basic'].includes(label)) return 'easy';
  return '';
}

function findDifficultyBranch(value, targetDifficulty, depth = 0, collected = { found: false, items: [] }, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || depth > 40 || seen.has(value)) return collected;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => findDifficultyBranch(item, targetDifficulty, depth + 1, collected, seen));
    return collected;
  }
  if (typeof value !== 'object') return collected;
  const keys = Object.keys(value);
  const difficultyMatches = keys.filter((key) => canonicalDifficulty(key)).length;

  if (difficultyMatches >= 1) {
    collected.found = true;
    const wantedKey = keys.find((key) => canonicalDifficulty(key) === canonicalDifficulty(targetDifficulty));
    if (wantedKey && targetDifficulty && String(targetDifficulty).toLowerCase() !== 'all') {
      const branchValue = value[wantedKey];
      if (Array.isArray(branchValue)) collected.items.push(...branchValue);
      else if (branchValue) collected.items.push(branchValue);
    }
    return collected; // this node is a difficulty grouping — don't also treat its siblings as separate sections
  }

  Object.values(value).forEach((item) => findDifficultyBranch(item, targetDifficulty, depth + 1, collected, seen));
  return collected;
}

function collectQuestionCandidates(value, candidates = [], inherited = {}, depth = 0, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || depth > 40 || seen.has(value)) return candidates;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => collectQuestionCandidates(item, candidates, inherited, depth + 1, seen));
    return candidates;
  }
  const text = value.question || value.question_text || value.questionText || value.prompt || value.stem || value.text;
  if (typeof text === 'string' && (value.options || value.answers || value.choices || value.correct_answer || value.answer)) {
    candidates.push({ ...inherited, ...value });
    return candidates;
  }
  const topic = value.topic || value.topic_name || value.topicName || value.subtopic || value.sub_topic || value.section || value.section_name || inherited.__inheritedTopic;
  const difficulty = value.difficulty || value.level || inherited.__inheritedDifficulty;
  Object.entries(value).forEach(([key, item]) => collectQuestionCandidates(item, candidates, {
    __inheritedTopic: topic,
    __inheritedDifficulty: canonicalDifficulty(key) || difficulty,
  }, depth + 1, seen));
  return candidates;
}

// Some friend-supplied question banks (e.g. gravitation.json) have far more
// questions per difficulty than a single test should ask. Shuffling before
// capping at 20 means each attempt samples a different subset instead of
// always showing the same first 20 questions in the file.
function shuffleArray(source) {
  const items = [...source];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function normalizeQuestions(payload, difficulty) {
  const root = payload?.questions || payload?.data || payload;

  // First, see if the JSON is structured with explicit Easy/Medium/Hard/Tough
  // branches anywhere inside it (possibly repeated once per section/topic —
  // all matching branches are merged together). If so, only look at the
  // questions for the requested difficulty.
  const difficultyBranch = findDifficultyBranch(root, difficulty);
  const searchRoot = difficultyBranch.found ? difficultyBranch.items : root;

  let candidates = collectQuestionCandidates(searchRoot);

  // If the structured branch existed but had nothing in it (e.g. difficulty
  // not yet filled in by the content creator), fall back to the whole file
  // rather than showing an empty test.
  if (difficultyBranch.found && !candidates.length) {
    candidates = collectQuestionCandidates(root);
  }

  let questions = candidates.map((question, index) => {
    const options = normalizeOptions(question.options || question.answers || question.choices);
    return {
      id: question.id || question.question_id || index + 1,
      text: cleanMathText(question.question || question.question_text || question.questionText || question.prompt || question.stem || question.text),
      options: options.map((opt) => ({ key: opt.key, text: cleanMathText(opt.text) })),
      correctAnswer: resolveCorrectAnswer(question.correct_answer || question.answer || question.correctOption || question.correct_option, options),
      difficulty: question.difficulty || question.level || question.__inheritedDifficulty || '',
      topicName: question.__inheritedTopic || question.topic_name || question.topic || question.section || question.section_name || '',
    };
  }).filter((question) => question.text && question.options.length >= 2);

  // Second shape: a flat question list where each question carries its own
  // "difficulty" field instead of being grouped under Easy/Medium/Hard keys.
  // Only filter this way if we didn't already narrow things down via a
  // structural branch above (avoids double-filtering / accidental empties).
  if (!difficultyBranch.found && difficulty) {
    const taggedQuestions = questions.filter((question) => question.difficulty);
    if (taggedQuestions.length) {
      const filtered = questions.filter((question) => (
        !question.difficulty || canonicalDifficulty(question.difficulty) === canonicalDifficulty(difficulty)
      ));
      // Only use the filtered set if it actually leaves us something to
      // practice with — never hand back an empty quiz just because the
      // difficulty label didn't match exactly.
      if (filtered.length) questions = filtered;
    }
  }

  return questions;
}

function normalizeOptions(source) {
  if (Array.isArray(source)) {
    return source.map((value, index) => {
      const rawText = typeof value === 'object' ? value.text || value.option || value.value || '' : String(value);
      const match = rawText.match(/^\s*([A-Za-z])\s*[).:-]\s*(.*)$/);
      return { key: (match?.[1] || String.fromCharCode(65 + index)).toUpperCase(), text: match?.[2] || rawText };
    });
  }
  if (source && typeof source === 'object') {
    return Object.entries(source).map(([key, value], index) => ({ key: normalizeAnswerKey(key) || String.fromCharCode(65 + index), text: typeof value === 'object' ? value.text || value.value || '' : String(value) }));
  }
  return [];
}

function resolveCorrectAnswer(answer, options) {
  const key = normalizeAnswerKey(answer);
  if (key && options.some((option) => option.key === key)) return key;
  const wanted = cleanMathText(answer).replace(/\s+/g, ' ').trim().toLowerCase();
  const match = options.find((option) => cleanMathText(option.text).replace(/\s+/g, ' ').trim().toLowerCase() === wanted);
  return match?.key || key;
}

// Question banks use LaTeX strings, but the app intentionally has no heavy
// math renderer. Convert the common notation to readable Unicode instead of
// showing students raw backslashes and dollar signs.
function cleanMathText(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/\\vec\{([A-Za-z0-9_+-]+)\}/g, '$1')
    .replace(/\\vec\s*([A-Za-z0-9])/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\epsilon/g, 'ε')
    .replace(/\\theta/g, 'θ')
    .replace(/\\pi/g, 'π')
    .replace(/\\infty/g, '∞')
    .replace(/\\cdot/g, '·')
    .replace(/\\neq/g, '≠')
    .replace(/\\pm/g, '±')
    .replace(/\\approx/g, '≈')
    .replace(/\\times/g, '×')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\tau/g, 'τ')
    .replace(/\\phi/g, 'ϕ')
    .replace(/\\psi/g, 'ψ')
    .replace(/\\rho/g, 'ρ')
    .replace(/\\rightarrow|->/g, '→')
    .replace(/\\Rightarrow|=>/g, '⇒')
    .replace(/[\\$]/g, '')
    .replace(/_\{?([0-9a-zA-Z+-]+)\}?/g, (_, match) => {
      const map = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        '+': '₊', '-': '₋', 'a': 'ₐ', 'e': 'ₑ', 'i': 'ᵢ', 'o': 'ₒ', 'u': 'ᵤ', 'x': 'ₓ', 'p': 'ₚ', 'q': 'q',
      };
      return [...match].map((c) => map[c] || c).join('');
    })
    .replace(/\^\{?([0-9a-zA-Z+-]+)\}?/g, (_, match) => {
      const map = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'x': 'ˣ', 'y': 'ʸ',
      };
      return [...match].map((c) => map[c] || c).join('');
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAnswerKey(answer) {
  if (answer === undefined || answer === null) return '';
  const stringValue = String(answer).trim();
  const match = stringValue.match(/(?:^|\s|\()([A-Za-z])(?:\s|\)|$|[).:-])/);
  return (match?.[1] || (stringValue.length === 1 ? stringValue : '')).toUpperCase();
}

function isCorrectAnswer(selected, correct) {
  return Boolean(selected && correct && String(selected).toUpperCase() === String(correct).toUpperCase());
}

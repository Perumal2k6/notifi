import { useCallback, useEffect, useState, useMemo } from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CheckCircle,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  TestTube,
  Trash2,
  UserCog,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import useCountdown, {
  formatCountdown,
  getScheduledDate,
} from "./hooks/useCountdown";
import useAudio from "./hooks/useAudio";
import SoundPicker from "./components/reminders/SoundPicker";
import SoundPreview from "./components/reminders/SoundPreview";
import ReminderCard from "./components/reminders/ReminderCard";
import useReminderScheduler from "./hooks/useReminderScheduler";
import { requestNotificationPermission, getNotificationPermission, showLocalNotification } from "./services/notificationService";
import { getServiceWorkerRegistration, registerServiceWorker, subscribeToPush } from "./services/pushService";
import {
  apiRequest,
  mapReminder,
  mapSound,
  mapUser,
  setAccessToken,
} from "./services/api";
import "./App.css";

const today = (() => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
})();
const legacySoundOptions = [
  "Default Alarm",
  "Classic Alarm",
  "Digital Alarm",
  "Bell",
  "Gentle Bell",
  "Morning Alarm",
];
const todayLabel = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export default function App() {
  const [users, setUsers] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [sounds, setSounds] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(() =>
    Boolean(sessionStorage.getItem("smart_reminder_access_token")),
  );

  // This effect hydrates React state from the authenticated API.
  // oxlint-disable react/set-state-in-effect
  useEffect(() => {
    for (const key of [
      "smart_reminder_users",
      "smart_reminder_reminders",
      "smart_reminder_current_user",
    ]) {
      localStorage.removeItem(key);
    }
    indexedDB.deleteDatabase("smart-reminder-audio");

    const token = sessionStorage.getItem("smart_reminder_access_token");
    if (!token) return;
    apiRequest("/auth/me")
      .then((user) => setCurrentUser(mapUser(user)))
      .catch((error) => {
        if (error.status === 401 || error.status === 403) {
          setAccessToken(null);
          toast.error("Your session expired. Please sign in again.");
        } else {
          toast.error(`Unable to connect to the backend: ${error.message}`);
        }
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const refreshReminders = useCallback(async (signal) => {
    const [soundData, reminderData] = await Promise.all([
      apiRequest("/sounds", { signal }),
      apiRequest("/reminders?page=1&page_size=100", { signal }),
    ]);
    if (signal?.aborted) return;
    const nextSounds = soundData.map(mapSound);
    setSounds(nextSounds);
    setReminders(reminderData.map((item) => mapReminder(item, nextSounds)));
  }, []);

  const refreshAdminData = useCallback(async (signal) => {
    const [userData, stats] = await Promise.all([
      apiRequest("/admin/users?page=1&page_size=100", { signal }),
      apiRequest("/admin/dashboard", { signal }),
    ]);
    if (signal?.aborted) return;
    setUsers(userData.items.map(mapUser));
    setAdminStats(stats);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const controller = new AbortController();
    // The API response hydrates authenticated account state for the UI.
    Promise.all([
      refreshReminders(controller.signal),
      currentUser.role === "ADMIN"
        ? refreshAdminData(controller.signal)
        : Promise.resolve(),
    ])
      .catch((error) => {
        if (!cancelled) toast.error(`Unable to load account data: ${error.message}`);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentUser, refreshAdminData, refreshReminders]);
  // oxlint-enable react/set-state-in-effect

  const login = async (identity, password) => {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: identity, password }),
    });
    setAccessToken(result.access_token);
    setCurrentUser(mapUser(result.user));
    return result.user;
  };

  const logout = () => {
    setAccessToken(null);
    setCurrentUser(null);
    setReminders([]);
    setSounds([]);
    setUsers([]);
    setAdminStats(null);
    toast.success("Signed out");
  };

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      {authLoading ? (
        <div className="main">Checking your session...</div>
      ) : (
      <Routes>
        <Route path="/login" element={<Login onLogin={login} />} />
        <Route
          path="*"
          element={
            currentUser ? (
              <Shell
                user={currentUser}
                logout={logout}
                users={users}
                reminders={reminders}
                sounds={sounds}
                adminStats={adminStats}
                refreshReminders={refreshReminders}
                refreshAdminData={refreshAdminData}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
      )}
    </BrowserRouter>
  );
}

function Login({ onLogin }) {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const user = await onLogin(identity, password);
      navigate(user.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (error) {
      toast.error(error.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="login-shell">
      <div className="login-art">
        <Brand />
        <div className="eyebrow">Smart Reminder</div>
        <h1>A calmer way to remember what matters.</h1>
        <p>
          Thoughtful reminders, reliable alarms, and a clear view of your day.
          Built for focused work.
        </p>
      </div>
      <div className="login-card-wrap">
        <form className="login-card" onSubmit={submit}>
          <Brand />
          <h2>Welcome back</h2>
          <p>Sign in to access your workspace.</p>
          <Field label="Email or username">
            <input
              className="input"
              value={identity}
              onChange={(event) => setIdentity(event.target.value)}
            />
          </Field>
          <Field label="Password">
            <div className="password-wrap">
              <input
                className="input"
                type={show ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label="Toggle password visibility"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
          <button className="primary-btn full-btn" type="submit" disabled={submitting}>
            Sign in <Check size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Bell size={18} />
      </span>
      Smart Reminder
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
function Avatar({ user }) {
  return (
    <span className={"avatar " + (user.role === "ADMIN" ? "admin" : "")}>
      {user.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Shell({
  user,
  logout,
  users,
  reminders,
  sounds,
  adminStats,
  refreshReminders,
  refreshAdminData,
}) {
  const location = useLocation();
  const isAdmin = user.role === "ADMIN";
  const [dueReminder, setDueReminder] = useState(null);
  const snoozeReminder = useCallback(async (reminder, minutes) => {
    try {
      await apiRequest(`/reminders/${reminder.id}/snooze`, {
        method: "POST",
        body: JSON.stringify({ minutes }),
      });
      await refreshReminders();
      setDueReminder(null);
      toast.success(`Reminder snoozed for ${minutes} minutes.`);
    } catch (error) {
      toast.error(`Unable to snooze reminder: ${error.message}`);
    }
  }, [refreshReminders]);
  const dismissReminder = useCallback(async (reminder) => {
    try {
      await apiRequest(`/reminders/${reminder.id}/dismiss`, { method: "POST" });
      await refreshReminders();
      setDueReminder(null);
      toast.success("Reminder dismissed.");
    } catch (error) {
      toast.error(`Unable to dismiss reminder: ${error.message}`);
    }
  }, [refreshReminders]);
  useReminderScheduler(
    reminders.filter((reminder) => reminder.userId === user.id),
    (reminder) => {
      setDueReminder(reminder);
    },
  );
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const receiveAction = (event) => {
      if (event.data?.type === 'SMART_REMINDER_PUSH_TRIGGER') {
        const reminder = reminders.find((item) => item.id === event.data.payload.reminderId);
        if (reminder) setDueReminder(reminder);
        return;
      }
      if (event.data?.type !== 'SMART_REMINDER_PUSH_ACTION') return;
      const reminder = reminders.find((item) => item.id === event.data.payload.reminderId);
      if (!reminder) return;
      if (event.data.payload.action === 'snooze') snoozeReminder(reminder, 5);
      else dismissReminder(reminder);
    };
    navigator.serviceWorker.addEventListener('message', receiveAction);
    return () => navigator.serviceWorker.removeEventListener('message', receiveAction);
  }, [reminders, snoozeReminder, dismissReminder]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const reminderId = params.get('reminderId');
    const snooze = parseInt(params.get('snooze'), 10) || 5;
    const alarmId = params.get('alarm');

    if (alarmId) {
      const reminder = reminders.find((item) => item.id === alarmId);
      if (reminder) setDueReminder(reminder);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (action && reminderId) {
      const reminder = reminders.find((item) => item.id === reminderId);
      if (reminder) {
        if (action === 'snooze') snoozeReminder(reminder, snooze);
        else dismissReminder(reminder);
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [reminders, snoozeReminder, dismissReminder]);
  const title = location.pathname.startsWith("/admin")
    ? "Admin overview"
    : location.pathname === "/reminders"
      ? "Reminders"
      : location.pathname.includes("create")
        ? "New reminder"
        : location.pathname.includes("edit")
          ? "Edit reminder"
          : location.pathname === "/settings"
            ? "Settings"
            : "Today";
  const links = isAdmin
    ? [
        ["/admin", "Overview", LayoutDashboard],
        ["/admin/users", "Users", Users],
        ["/admin/settings", "Settings", Settings],
      ]
    : [
        ["/dashboard", "Today", Home],
        ["/reminders", "Reminders", CalendarDays],
        ["/settings", "Settings", Settings],
      ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="nav-label">Workspace</div>
        <nav className="nav">
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className="nav-link">
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-mini">
            <Avatar user={user} />
            <div>
              <strong>{user.name}</strong>
              <span className="muted">
                {isAdmin ? "Administrator" : "Personal workspace"}
              </span>
            </div>
            <button className="small-icon" onClick={logout} title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="eyebrow">Smart Reminder</div>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <button
              className="icon-btn"
              aria-label="Toggle theme"
              onClick={() => document.body.classList.toggle("dark")}
            >
              <Moon size={17} />
            </button>
            <button className="ghost-btn" onClick={logout}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </header>
        <GlobalNotificationPrompt />
        <Routes>
          <Route
            path="/dashboard"
            element={<Dashboard user={user} reminders={reminders} />}
          />
          <Route
            path="/reminders"
            element={
              <Reminders
                user={user}
                reminders={reminders}
              refreshReminders={refreshReminders}
              />
            }
          />
          <Route
            path="/reminders/create"
            element={
            <ReminderEditor user={user} sounds={sounds} refreshReminders={refreshReminders} />
            }
          />
          <Route
            path="/reminders/:id/edit"
            element={
              <ReminderEditor
                user={user}
                reminders={reminders}
                sounds={sounds}
                refreshReminders={refreshReminders}
              />
            }
          />
          <Route path="/settings" element={<SettingsPage user={user} sounds={sounds} />} />
          <Route
            path="/admin"
            element={<AdminDashboard users={users} stats={adminStats} />}
          />
          <Route
            path="/admin/users"
            element={<UsersPage users={users} refreshAdminData={refreshAdminData} />}
          />
          <Route
            path="/admin/settings"
            element={<SettingsPage user={user} admin sounds={sounds} />}
          />
          <Route
            path="*"
            element={
              <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />
            }
          />
        </Routes>
        {dueReminder && <AlarmPreview reminder={dueReminder} close={() => dismissReminder(dueReminder)} onSnooze={(minutes) => snoozeReminder(dueReminder, minutes)} autoTriggered />}
      </main>
    </div>
  );
}
function Stat({ icon: Icon, label, value, orange, blue }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span
          className={"stat-icon " + (orange ? "orange" : blue ? "blue" : "")}
        >
          <Icon size={16} />
        </span>
      </div>
      <h3>{value}</h3>
    </div>
  );
}
function Dashboard({ user, reminders }) {
  const mine = reminders.filter((item) => item.userId === user.id);
  const upcoming = mine
    .filter((item) => item.active && !item.completed)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 4);
  return (
    <div className="main">
      <div className="welcome">
        <div>
          <div className="eyebrow">{todayLabel}</div>
          <h2>Good morning, {user.name.split(" ")[0]}</h2>
          <p>Here is your focus for the day.</p>
        </div>
        <NavLink to="/reminders/create" className="primary-btn">
          <Plus size={17} /> Create reminder
        </NavLink>
      </div>
      <div className="stats-grid">
        <Stat
          icon={CalendarDays}
          label="Today's reminders"
          value={mine.filter((item) => item.date === today).length}
        />
        <Stat
          icon={Clock3}
          label="Upcoming"
          value={mine.filter((item) => item.active && !item.completed).length}
          blue
        />
        <Stat
          icon={Check}
          label="Completed"
          value={mine.filter((item) => item.completed).length}
          orange
        />
        <Stat
          icon={Volume2}
          label="Active alarms"
          value={mine.filter((item) => item.active).length}
        />
      </div>
      <div className="content-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Upcoming reminders</h3>
            <NavLink className="text-link" to="/reminders">
              View all
            </NavLink>
          </div>
          {upcoming.length ? (
            upcoming.map((item) => (
              <ReminderRow key={item.id} reminder={item} />
            ))
          ) : (
            <Empty message="No upcoming reminders" />
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h3>Recent activity</h3>
            <MoreHorizontal size={18} className="muted" />
          </div>
          <div className="activity">
            <span className="activity-icon">
              <Check size={15} />
            </span>
            <p>
              <strong>Workspace ready</strong>
              <br />
              <span className="muted">Your account data is synced with the backend.</span>
              <br />
              <time>Just now</time>
            </p>
          </div>
          <div className="activity">
            <span className="activity-icon">
              <Bell size={15} />
            </span>
            <p>
              <strong>{upcoming.length ? "Next reminder" : "No upcoming reminders"}</strong>
              <br />
              <span className="muted">
                {upcoming.length ? upcoming[0].title : "Create a reminder when you are ready."}
              </span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
function ReminderRow({ reminder }) {
  const countdown = useCountdown(reminder.date, reminder.time);
  return (
    <div className="reminder-row">
      <div className="time-chip">{formatTime(reminder.time)}</div>
      <div className="reminder-info">
        <strong>{reminder.title}</strong>
        <span>{reminder.description || "No description"}</span>
      </div>
      <div className="sound-tag">
        <Volume2 size={13} />
        {reminder.soundName}
      </div>
      <span className="dashboard-countdown">
        {countdown.due ? "Due now" : formatCountdown(countdown)}
      </span>
      <span className="status-dot" />
    </div>
  );
}
function Empty({ message = "No reminders yet" }) {
  return (
    <div className="empty">
      <CalendarDays size={25} />
      <strong>{message}</strong>
      <p>Create your first reminder to get started.</p>
      <NavLink to="/reminders/create" className="secondary-btn">
        <Plus size={15} /> Create reminder
      </NavLink>
    </div>
  );
}

// oxlint-disable-next-line no-unused-vars
function LegacyReminders({ user, reminders, setReminders }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [alarm, setAlarm] = useState(null);
  const mine = reminders
    .filter((item) => item.userId === user.id)
    .filter((item) =>
      (item.title + item.description)
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter(
      (item) =>
        status === "all" || (status === "active" ? item.active : !item.active),
    );
  const remove = (id) => {
    setReminders(reminders.filter((item) => item.id !== id));
    toast.success("Reminder deleted");
  };
  const toggle = (id) => {
    setReminders(
      reminders.map((item) =>
        item.id === id ? { ...item, active: !item.active } : item,
      ),
    );
    toast.success("Reminder status updated");
  };
  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h2>Reminders</h2>
          <p>Keep your commitments visible and on time.</p>
        </div>
        <button
          className="primary-btn"
          onClick={() => navigate("/reminders/create")}
        >
          <Plus size={17} /> New reminder
        </button>
      </div>
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input
            className="input"
            placeholder="Search reminders"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          className="select"
          style={{ width: 145 }}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <section className="panel">
        {mine.length ? (
          mine
            .sort(
              (a, b) =>
                a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
            )
            .map((item) => (
              <div className="reminder-row" key={item.id}>
                <div className="time-chip">
                  {formatTime(item.time)}
                  <br />
                  <small>{item.date.slice(5)}</small>
                </div>
                <div className="reminder-info">
                  <strong>{item.title}</strong>
                  <span>
                    {item.description || "No description"} · Snooze{" "}
                    {item.snoozeMinutes} min
                  </span>
                </div>
                <div className="sound-tag">
                  <Volume2 size={13} />
                  {item.soundName}
                </div>
                <span className={"badge " + (!item.active ? "off" : "")}>
                  {item.active ? "Active" : "Off"}
                </span>
                <div className="actions">
                  <button
                    className="small-icon"
                    onClick={() => setAlarm(item)}
                    title="Test alarm"
                  >
                    <Bell size={15} />
                  </button>
                  <button
                    className="small-icon"
                    onClick={() => navigate("/reminders/" + item.id + "/edit")}
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="small-icon"
                    onClick={() => toggle(item.id)}
                    title="Toggle"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    className="small-icon"
                    onClick={() => remove(item.id)}
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
        ) : (
          <Empty message="No reminders found" />
        )}
      </section>
      {alarm && (
        <LegacyAlarmPreview reminder={alarm} close={() => setAlarm(null)} />
      )}
    </div>
  );
}
function LegacyAlarmPreview({ reminder, close }) {
  const snooze = (value) => {
    toast.success("Alarm snoozed", {
      description: `We will remind you again in ${value} minutes.`,
    });
    close();
  };
  return (
    <div className="modal-backdrop">
      <div className="modal alarm-modal">
        <div className="alarm-bell">
          <Bell size={27} />
        </div>
        <h3>{reminder.title}</h3>
        <p>
          {reminder.description || "Your reminder is ready."}
          <br />
          <strong>
            {formatTime(reminder.time)} · {reminder.soundName}
          </strong>
        </p>
        <div className="eyebrow">Test alarm</div>
        <div className="snooze-grid">
          {[5, 10, 15, 20, 30].map((value) => (
            <button key={value} onClick={() => snooze(value)}>
              {value} min
            </button>
          ))}
        </div>
        <button className="secondary-btn" onClick={close}>
          Dismiss alarm
        </button>
      </div>
    </div>
  );
}

// oxlint-disable-next-line no-unused-vars
function LegacyReminderEditor({ user, reminders = [], setReminders }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const existing = reminders.find((item) => item.id === id);
  const [form, setForm] = useState(
    existing || {
      title: "",
      description: "",
      date: today,
      time: "09:00",
      soundName: sounds[0],
      snoozeMinutes: 5,
      active: true,
    },
  );
  const update = (key, value) => setForm({ ...form, [key]: value });
  const submit = (event) => {
    event.preventDefault();
    if (
      !form.title ||
      !form.date ||
      !form.time ||
      !form.soundName ||
      !form.snoozeMinutes
    ) {
      toast.error("Please complete all required fields");
      return;
    }
    if (existing) {
      setReminders(
        reminders.map((item) => (item.id === id ? { ...item, ...form } : item)),
      );
      toast.success("Reminder updated");
    } else {
      setReminders([
        ...reminders,
        { ...form, id: "r" + Date.now(), userId: user.id, completed: false },
      ]);
      toast.success("Reminder created");
    }
    navigate("/reminders");
  };
  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h2>{existing ? "Edit reminder" : "Create reminder"}</h2>
          <p>Set a clear intention for your next work block.</p>
        </div>
      </div>
      <form className="panel form-panel" onSubmit={submit}>
        <div className="form-grid">
          <div className="field full">
            <label>Work title *</label>
            <input
              className="input"
              placeholder="e.g. Frontend development"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
            />
          </div>
          <div className="field full">
            <label>Description</label>
            <textarea
              className="textarea"
              placeholder="What needs to get done?"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </div>
          <Field label="Date *">
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(event) => update("date", event.target.value)}
            />
          </Field>
          <Field label="Time *">
            <input
              className="input"
              type="time"
              value={form.time}
              onChange={(event) => update("time", event.target.value)}
            />
          </Field>
          <Field label="Alarm sound *">
            <select
              className="select"
              value={form.soundName}
              onChange={(event) => update("soundName", event.target.value)}
            >
              {legacySoundOptions.map((sound) => (
                <option key={sound}>{sound}</option>
              ))}
            </select>
          </Field>
          <Field label="Snooze duration *">
            <select
              className="select"
              value={form.snoozeMinutes}
              onChange={(event) =>
                update("snoozeMinutes", Number(event.target.value))
              }
            >
              {[5, 10, 15, 20, 30].map((value) => (
                <option key={value} value={value}>
                  {value} minutes
                </option>
              ))}
            </select>
          </Field>
          <div className="field full">
            <div className="switch-row">
              <div>
                <strong>Reminder active</strong>
                <div className="muted field-help">
                  You can pause this alarm at any time.
                </div>
              </div>
              <button
                type="button"
                className={"switch " + (form.active ? "on" : "")}
                onClick={() => update("active", !form.active)}
                aria-label="Toggle active"
              >
                <i />
              </button>
            </div>
          </div>
        </div>
        <div className="form-footer">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate("/reminders")}
          >
            Cancel
          </button>
          <button className="primary-btn" type="submit">
            {existing ? "Save changes" : "Save reminder"}
          </button>
        </div>
      </form>
    </div>
  );
}

function UsersPage({ users, refreshAdminData }) {
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "USER",
  });
  const shown = users.filter((user) =>
    (user.name + user.username + user.email)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const create = async (event) => {
    event.preventDefault();
    if (!draft.name || !draft.username || !draft.email || draft.password.length < 8) {
      toast.error("Complete all user fields");
      return;
    }
    try {
      await apiRequest("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          full_name: draft.name,
          username: draft.username,
          email: draft.email,
          password: draft.password,
          role: draft.role,
        }),
      });
      await refreshAdminData();
      setOpen(false);
      setDraft({ name: "", username: "", email: "", password: "", role: "USER" });
      toast.success("User created");
    } catch (error) {
      toast.error(`Unable to create user: ${error.message}`);
    }
  };
  const saveEdit = async (event) => {
    event.preventDefault();
    try {
      await apiRequest(`/admin/users/${editingUser.id}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: editingUser.name,
          email: editingUser.email,
          role: editingUser.role,
        }),
      });
      await refreshAdminData();
      setEditingUser(null);
      toast.success("User updated");
    } catch (error) {
      toast.error(`Unable to update user: ${error.message}`);
    }
  };
  const toggle = async (user) => {
    try {
      await apiRequest(`/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !user.active }),
      });
      await refreshAdminData();
      toast.success("User status updated");
    } catch (error) {
      toast.error(`Unable to update user: ${error.message}`);
    }
  };
  const remove = async (id) => {
    try {
      await apiRequest(`/admin/users/${id}`, { method: "DELETE" });
      await refreshAdminData();
      toast.success("User deleted");
    } catch (error) {
      toast.error(`Unable to delete user: ${error.message}`);
    }
  };
  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h2>Users</h2>
          <p>Manage access to your reminder workspace.</p>
        </div>
        <button className="primary-btn" onClick={() => setOpen(true)}>
          <Plus size={17} /> Create user
        </button>
      </div>
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input
            className="input"
            placeholder="Search users"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <section className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="person">
                    <Avatar user={user} />
                    <div>
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </div>
                  </div>
                </td>
                <td>{user.username}</td>
                <td>
                  <span className="badge admin-badge">{user.role}</span>
                </td>
                <td>
                  <span className={"badge " + (!user.active ? "off" : "")}>
                    {user.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>{user.createdAt || "—"}</td>
                <td>
                  <div className="actions">
                    <button
                      className="small-icon"
                      onClick={() => setEditingUser({ ...user, name: user.name, email: user.email, role: user.role })}
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="small-icon"
                      onClick={() => toggle(user)}
                      title="Toggle status"
                    >
                      <UserCog size={15} />
                    </button>
                    <button
                      className="small-icon"
                      onClick={() => remove(user.id)}
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {open && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={create}>
            <div className="modal-head">
              <h3>Create user</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="form-grid">
              <div className="field full">
                <label>Full name</label>
                <input
                  className="input"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </div>
              <Field label="Username">
                <input
                  className="input"
                  value={draft.username}
                  onChange={(event) =>
                    setDraft({ ...draft, username: event.target.value })
                  }
                />
              </Field>
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  value={draft.email}
                  onChange={(event) =>
                    setDraft({ ...draft, email: event.target.value })
                  }
                />
              </Field>
              <Field label="Role">
                <select
                  className="select"
                  value={draft.role}
                  onChange={(event) =>
                    setDraft({ ...draft, role: event.target.value })
                  }
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </Field>
              <Field label="Password">
                <input
                  className="input"
                  type="password"
                  minLength={8}
                  value={draft.password}
                  onChange={(event) =>
                    setDraft({ ...draft, password: event.target.value })
                  }
                />
              </Field>
            </div>
            <div className="form-footer">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className="primary-btn">Create user</button>
            </div>
          </form>
        </div>
      )}
      {editingUser && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={saveEdit}>
            <div className="modal-head">
              <h3>Edit user</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEditingUser(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="form-grid">
              <div className="field full">
                <label>Full name</label>
                <input
                  className="input"
                  value={editingUser.name}
                  onChange={(event) =>
                    setEditingUser({ ...editingUser, name: event.target.value })
                  }
                />
              </div>
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  value={editingUser.email}
                  onChange={(event) =>
                    setEditingUser({ ...editingUser, email: event.target.value })
                  }
                />
              </Field>
              <Field label="Role">
                <select
                  className="select"
                  value={editingUser.role}
                  onChange={(event) =>
                    setEditingUser({ ...editingUser, role: event.target.value })
                  }
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </Field>
            </div>
            <div className="form-footer">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </button>
              <button className="primary-btn">Save changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
function AdminDashboard({ users, stats }) {
  const totalUsers = stats?.total_users ?? users.length;
  const activeUsers = stats?.active_users ?? users.filter((user) => user.active).length;
  const inactiveUsers = stats?.inactive_users ?? totalUsers - activeUsers;
  const totalReminders = stats?.total_reminders ?? 0;
  return (
    <div className="main">
      <div className="welcome">
        <div>
          <div className="eyebrow">{todayLabel}</div>
          <h2>Good morning, Admin</h2>
          <p>A quick pulse on your workspace.</p>
        </div>
        <NavLink to="/admin/users" className="primary-btn">
          <Plus size={17} /> Create user
        </NavLink>
      </div>
      <div className="stats-grid">
        <Stat icon={Users} label="Total users" value={totalUsers} />
        <Stat
          icon={ShieldCheck}
          label="Active users"
          value={activeUsers}
          blue
        />
        <Stat
          icon={UserCog}
          label="Inactive users"
          value={inactiveUsers}
          orange
        />
        <Stat
          icon={CalendarDays}
          label="Total reminders"
          value={totalReminders}
        />
      </div>
      <div className="content-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Recent users</h3>
            <NavLink className="text-link" to="/admin/users">
              Manage users
            </NavLink>
          </div>
          {users.slice(0, 4).map((user) => (
            <div className="activity" key={user.id}>
              <Avatar user={user} />
              <p>
                <strong>{user.name}</strong>
                <br />
                <span className="muted">{user.email}</span>
              </p>
              <span className="badge">
                {user.active ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h3>Recent activity</h3>
            <MoreHorizontal size={18} className="muted" />
          </div>
          <div className="activity">
            <span className="activity-icon">
              <Users size={15} />
            </span>
            <p>
              <strong>{totalUsers} workspace members</strong>
              <br />
              <span className="muted">User directory is up to date.</span>
            </p>
          </div>
          <div className="activity">
            <span className="activity-icon">
              <CalendarDays size={15} />
            </span>
            <p>
              <strong>{totalReminders} reminders tracked</strong>
              <br />
              <span className="muted">Across the connected workspace.</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
function BrowserNotificationSettings() {
  const [permission, setPermission] = useState(getNotificationPermission());
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  const checkStatus = useCallback(async () => {
    const p = getNotificationPermission();
    setPermission(p);
    if (p === "granted") {
      const reg = await getServiceWorkerRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          try {
            await apiRequest("/notifications/subscribe", {
              method: "POST",
              body: JSON.stringify(sub.toJSON()),
            });
            setHasSubscription(true);
            console.log("[Push] Subscription verified with backend on load.");
          } catch (e) {
            console.error("[Push] Failed to verify subscription with backend:", e);
            setHasSubscription(false);
          }
        } else {
          setHasSubscription(false);
        }
      } else {
        setHasSubscription(false);
      }
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const enableNotifications = async () => {
    setIsEnabling(true);
    try {
      const nextPermission = await requestNotificationPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setIsEnabling(false);
        return;
      }

      await registerServiceWorker();
      const { public_key } = await apiRequest("/notifications/vapid-public-key");
      const subscription = await subscribeToPush(public_key);
      
      await apiRequest("/notifications/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      setHasSubscription(true);
      toast.success("Browser notifications enabled successfully.");
    } catch (error) {
      toast.error("Could not enable browser notifications. Please try again.");
      console.error(error);
    } finally {
      setIsEnabling(false);
    }
  };

  const testNotification = async () => {
    try {
      const res = await apiRequest("/notifications/test", { method: "POST" });
      toast.success(res.message || "Test notification sent.");
    } catch (error) {
      toast.error(`Test failed: ${error.message}`);
    }
  };

  const disableNotifications = async () => {
     try {
       const reg = await getServiceWorkerRegistration();
       if (reg) {
         const sub = await reg.pushManager.getSubscription();
         if (sub) await sub.unsubscribe();
       }
       setHasSubscription(false);
       toast.success("Push notifications disabled on this device.");
     } catch (e) {
       toast.error("Failed to disable notifications.");
     }
  };

  const openSettings = () => {
    toast.info("Please open your browser's site settings (often the lock icon in the address bar) to allow notifications.", { duration: 6000 });
  };

  if (permission === "unsupported") {
    return (
      <div className="notification-settings-panel">
        <div className="ns-header">
          <Bell size={20} className="ns-icon" /> <strong>Browser Notifications</strong>
        </div>
        <div className="ns-status"><AlertTriangle size={16} /> <span>Status: ⚠️ Not Supported</span></div>
        <p className="ns-desc">Your current browser or environment does not support browser notifications.</p>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="notification-settings-panel">
        <div className="ns-header">
          <Bell size={20} className="ns-icon" /> <strong>Browser Notifications</strong>
        </div>
        <div className="ns-status blocked"><AlertTriangle size={16} /> <span>Status: 🟠 Blocked</span></div>
        <p className="ns-desc">Browser notifications are blocked. Please allow notifications from your browser settings to receive reminder alerts.</p>
        <button type="button" className="secondary-btn" onClick={openSettings}><ExternalLink size={16} /> Open Browser Settings</button>
      </div>
    );
  }

  if (permission === "granted" && hasSubscription) {
    return (
      <div className="notification-settings-panel">
        <div className="ns-header">
          <Bell size={20} className="ns-icon" /> <strong>Browser Notifications</strong>
        </div>
        <div className="ns-status enabled"><CheckCircle size={16} /> <span>Status: 🟢 Enabled</span></div>
        <p className="ns-desc">Browser notifications are enabled. You can receive reminder notifications while using other websites or when Smart Reminder is in the background.</p>
        <div className="ns-actions">
          <button type="button" className="primary-btn" onClick={testNotification}><Bell size={16} /> Test Notification</button>
          <button type="button" className="secondary-btn" onClick={disableNotifications}>Disable Notifications</button>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-settings-panel">
      <div className="ns-header">
        <Bell size={20} className="ns-icon" /> <strong>Browser Notifications</strong>
      </div>
      <div className="ns-status not-enabled">
        <AlertTriangle size={16} /> <span>Status: {permission === "granted" ? "🟡 Setup Required" : "Not Enabled"}</span>
      </div>
      <p className="ns-desc">Enable browser notifications to receive reminder alerts even when Smart Reminder is running in the background.</p>
      <button type="button" className="primary-btn" onClick={enableNotifications} disabled={isEnabling}>
        {isEnabling ? "Enabling..." : "Enable Notifications"}
      </button>
    </div>
  );
}

function SettingsPage({ user, admin, sounds }) {
  const [defaultSound, setDefaultSound] = useState(() => localStorage.getItem("smart_reminder_default_sound") || "");

  const handleDefaultSoundChange = (e) => {
    const val = e.target.value;
    setDefaultSound(val);
    if (val) localStorage.setItem("smart_reminder_default_sound", val);
    else localStorage.removeItem("smart_reminder_default_sound");
    toast.success("Default music updated");
  };

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h2>{admin ? "Admin settings" : "Settings"}</h2>
          <p>Manage your profile and notification preferences.</p>
        </div>
      </div>
      <section className="panel form-panel">
        <div className="form-grid">
          <Field label="Full name">
            <input className="input" value={user.name} readOnly />
          </Field>
          <Field label="Username">
            <input className="input" value={user.username} readOnly />
          </Field>
          <div className="field full">
            <label>Email</label>
            <input className="input" value={user.email} readOnly />
          </div>
          <div className="field full">
            <label>Default Music</label>
            <select className="select" value={defaultSound} onChange={handleDefaultSoundChange}>
              <option value="">(None)</option>
              {sounds?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="muted field-help">This music will be selected by default when creating new reminders.</div>
          </div>
          <div className="field full">
            <BrowserNotificationSettings />
          </div>
        </div>
      </section>
    </div>
  );
}
function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function GlobalNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState("prompt");
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    const p = getNotificationPermission();
    if (p === "default" && !sessionStorage.getItem("smart_reminder_prompt_dismissed")) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem("smart_reminder_prompt_dismissed", "1");
    setVisible(false);
  };

  const enable = async () => {
    setIsEnabling(true);
    try {
      const nextPermission = await requestNotificationPermission();
      if (nextPermission === "denied") {
        setStatus("blocked");
        return;
      }
      if (nextPermission !== "granted") {
        dismiss();
        return;
      }

      await registerServiceWorker();
      const { public_key } = await apiRequest("/notifications/vapid-public-key");
      const subscription = await subscribeToPush(public_key);
      
      await apiRequest("/notifications/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      toast.success("Browser notifications enabled successfully.");
      dismiss();
    } catch (error) {
      toast.error("Could not enable browser notifications. Please try again.");
      console.error(error);
    } finally {
      setIsEnabling(false);
    }
  };

  if (!visible) return null;

  if (status === "blocked") {
    return (
      <div className="global-prompt">
         <div className="gp-content">
            <div className="gp-icon blocked"><AlertTriangle size={20} /></div>
            <div className="gp-text">
               <strong>Notifications Blocked</strong>
               <p>Browser notifications are blocked. You can enable them later from your browser site settings.</p>
            </div>
         </div>
         <div className="gp-actions">
           <button className="primary-btn" onClick={() => {
              toast.info("Please open your browser's site settings to allow notifications.");
              dismiss();
           }}>Open Notification Settings</button>
           <button className="secondary-btn" onClick={dismiss}>Close</button>
         </div>
      </div>
    );
  }

  return (
      <div className="global-prompt">
         <div className="gp-content">
            <div className="gp-icon"><Bell size={20} /></div>
            <div className="gp-text">
               <strong>Enable Smart Reminder Notifications</strong>
               <p>Allow notifications so you can receive reminder alerts even when Smart Reminder is running in the background or you are using another website.</p>
            </div>
         </div>
         <div className="gp-actions">
           <button className="primary-btn" onClick={enable} disabled={isEnabling}>
              {isEnabling ? "Enabling..." : "Allow Notifications"}
           </button>
           <button className="secondary-btn" onClick={dismiss} disabled={isEnabling}>Not Now</button>
         </div>
      </div>
  );
}

function Reminders({ user, reminders, refreshReminders }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [alarm, setAlarm] = useState(null);
  const mine = reminders
    .filter((item) => item.userId === user.id)
    .filter((item) =>
      `${item.title} ${item.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter(
      (item) =>
        status === "all" || (status === "active" ? item.active : !item.active),
    );
  const remove = async (id) => {
    try {
      await apiRequest(`/reminders/${id}`, { method: "DELETE" });
      await refreshReminders();
      toast.success("Reminder deleted");
    } catch (error) {
      toast.error(`Unable to delete reminder: ${error.message}`);
    }
  };
  const toggle = async (reminder) => {
    const active = !reminder.active;
    try {
      await apiRequest(`/reminders/${reminder.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          is_active: active,
          ...(active ? { status: "PENDING" } : {}),
        }),
      });
      await refreshReminders();
      toast.success("Reminder status updated");
    } catch (error) {
      toast.error(`Unable to update reminder: ${error.message}`);
    }
  };
  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h2>Reminders</h2>
          <p>Keep your commitments visible and on time.</p>
        </div>
        <button
          className="primary-btn"
          onClick={() => navigate("/reminders/create")}
        >
          <Plus size={17} /> New reminder
        </button>
      </div>
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input
            className="input"
            placeholder="Search reminders"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          className="select"
          style={{ width: 145 }}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <section className="reminder-card-list">
        {mine.length ? (
          [...mine]
            .sort(
              (a, b) =>
                a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
            )
            .map((item) => (
              <ReminderCard
                key={item.id}
                reminder={item}
                onDelete={() => remove(item.id)}
                onToggle={() => toggle(item)}
                onAlarm={() => setAlarm(item)}
              />
            ))
        ) : (
          <div className="panel">
            <Empty message="No reminders found" />
          </div>
        )}
      </section>
      {alarm && <AlarmPreview reminder={alarm} close={() => setAlarm(null)} />}
    </div>
  );
}

function ReminderEditor({ reminders = [], sounds, refreshReminders }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const existing = reminders.find((item) => item.id === id);
  const defaultSoundId = localStorage.getItem("smart_reminder_default_sound");
  const initialSound = sounds.find((item) => item.id === existing?.soundId) || sounds.find(s => s.id === defaultSoundId) || sounds[0] || null;
  const [form, setForm] = useState(
    existing
      ? { ...existing, sound: initialSound }
      : {
          title: "",
          description: "",
          date: today,
          time: "09:00",
          sound: initialSound,
          snoozeMinutes: 5,
          active: true,
        },
  );
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (
      !form.title ||
      !form.date ||
      !form.time ||
      !form.sound ||
      !form.snoozeMinutes
    ) {
      toast.error("Please complete all required fields");
      return;
    }
    const initialSchedule = existing
      ? `${existing.date}T${existing.time}`
      : null;
    const scheduledDate = getScheduledDate(form.date, form.time);
    const now = new Date();
    now.setSeconds(0, 0);
    
    if (
      scheduledDate.getTime() < now.getTime() &&
      `${form.date}T${form.time}` !== initialSchedule
    ) {
      toast.error("Please select a future time.");
      return;
    }
    const reminder = {
      title: form.title,
      description: form.description || null,
      scheduled_at: getScheduledDate(form.date, form.time).toISOString(),
      sound_id: form.sound.id,
      snooze_minutes: form.snoozeMinutes,
      is_active: form.active,
    };
    try {
      await apiRequest(existing ? `/reminders/${id}` : "/reminders", {
        method: existing ? "PUT" : "POST",
        body: JSON.stringify(reminder),
      });
      await refreshReminders();
      toast.success(existing ? "Reminder updated" : "Reminder created");
      navigate("/reminders");
    } catch (error) {
      toast.error(`Unable to save reminder: ${error.message}`);
    }
  };
  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h2>{existing ? "Edit reminder" : "Create reminder"}</h2>
          <p>Set a clear intention for your next work block.</p>
        </div>
      </div>
      <form className="panel form-panel" onSubmit={submit}>
        <div className="form-grid">
          <div className="field full">
            <label>Work title *</label>
            <input
              className="input"
              placeholder="e.g. Frontend development"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
            />
          </div>
          <div className="field full">
            <label>Description</label>
            <textarea
              className="textarea"
              placeholder="What needs to get done?"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </div>
          <Field label="Date *">
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(event) => update("date", event.target.value)}
            />
          </Field>
          <Field label="Time *">
            <input
              className="input"
              type="time"
              value={form.time}
              onChange={(event) => update("time", event.target.value)}
            />
          </Field>
          <div className="field full">
            <SoundPicker
              sounds={sounds}
              value={form.sound}
              onChange={(sound) => update("sound", sound)}
            />
          </div>
          <Field label="Snooze duration *">
            <select
              className="select"
              value={form.snoozeMinutes}
              onChange={(event) =>
                update("snoozeMinutes", Number(event.target.value))
              }
            >
              {[5, 10, 15, 20, 30].map((value) => (
                <option key={value} value={value}>
                  {value} minutes
                </option>
              ))}
            </select>
          </Field>
          <div className="field full">
            <div className="switch-row">
              <div>
                <strong>Reminder active</strong>
                <div className="muted field-help">
                  You can pause this alarm at any time.
                </div>
              </div>
              <button
                type="button"
                className={"switch " + (form.active ? "on" : "")}
                onClick={() => update("active", !form.active)}
                aria-label="Toggle active"
              >
                <i />
              </button>
            </div>
          </div>
        </div>
        <div className="form-footer">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate("/reminders")}
          >
            Cancel
          </button>
          <button className="primary-btn" type="submit">
            {existing ? "Save changes" : "Save reminder"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AlarmPreview({ reminder, close, onSnooze, onDismiss, autoTriggered = false }) {
  const sound = {
    name: reminder.soundName,
    url: reminder.soundUrl,
    soundType: reminder.isCustom ? "custom" : "default",
  };
  const countdown = useCountdown(reminder);
  const playUrl = sound.url;
  const handleDueAudioError = useCallback((details) => {
    console.error("Due reminder audio error:", details);
    if (details?.type === "restriction") toast.error("Browser playback restriction: click Test Sound in the alarm dialog.");
    else toast.error("Sound file could not be loaded.");
  }, []);
  const audioOptions = useMemo(() => ({ loop: true, timeout: 60000 }), []);
  const { play, stop } = useAudio(playUrl, handleDueAudioError, audioOptions);
      useEffect(() => {
        if (!autoTriggered) return undefined;
        play();
        return () => stop();
      }, [autoTriggered, play, stop]);
  const snooze = (value) => {
        stop();
        if (onSnooze) onSnooze(value);
        else {
          toast.success(`Reminder snoozed for ${value} minutes.`);
          close();
        }
  };
      const dismiss = () => { stop(); if (onDismiss) onDismiss(); else close(); };
  return (
    <div className="modal-backdrop">
      <div className="modal alarm-modal">
        <div className="alarm-bell">
          <Bell size={27} />
        </div>
        <div className="eyebrow">
          {reminder.status === "SNOOZED" ? "Snoozed" : "Reminder"}
        </div>
        <h3>{reminder.title}</h3>
        <p>{reminder.description || "Your reminder is ready."}</p>
        <div className="alarm-details">
          <span>
            Original alarm: {reminder.date === today ? "Today" : reminder.date} ·{" "}
            {formatTime(reminder.time)}
          </span>
          {reminder.status === "SNOOZED" && (
            <>
              <span>Snoozed for: {reminder.snoozeMinutes} minutes</span>
              <span>
                Next alarm: {formatTime(new Date(reminder.nextTriggerAt).toTimeString().substring(0, 5))}
              </span>
            </>
          )}
          <strong>
            {countdown.due
              ? "Due now"
              : `ALARM AGAIN IN ${formatCountdown(countdown)}`}
          </strong>
        </div>
        <div className="snooze-grid">
          {[5, 10, 15, 20, 30].map((value) => (
            <button key={value} onClick={() => snooze(value)}>
              Snooze {value} min
            </button>
          ))}
        </div>
        <button className="secondary-btn" onClick={dismiss}>
          OFF
        </button>
      </div>
    </div>
  );
}

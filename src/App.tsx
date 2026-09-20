import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Archive,
  Check,
  ChevronRight,
  CircleDot,
  Gauge,
  History,
  Home,
  Plus,
  Save,
  Settings2,
  Target,
} from "lucide-react";
import "./App.css";
import {
  CLUBS,
  DISTANCE_CLUBS,
  caddiePlan,
  clubSummary,
  convertMetres,
  formatDate,
  personalisedRecommendation,
  roundTotal,
  seedData,
  startOfWeek,
} from "./domain";
import type {
  AppData,
  ClubName,
  FocusCategory,
  HoleShot,
  RoundHole,
  Screen,
  ShotPhase,
} from "./domain";
import { loadCloudData, saveCloudData } from "./cloudStorage";
import { isCloudConfigured, supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";
import {
  HERMANUS_HOLE_DIAGRAMS,
  HERMANUS_LOOPS,
  holeDistance,
  holePar,
  loopLabel,
} from "./course";

const navItems: Array<{ id: Screen; label: string; icon: typeof Home }> = [
  { id: "today", label: "Home", icon: Home },
  { id: "range", label: "Range", icon: Target },
  { id: "distances", label: "Distances", icon: Gauge },
  { id: "round", label: "Round", icon: CircleDot },
  { id: "progress", label: "Insights", icon: Activity },
];
const categories: FocusCategory[] = [
  "Tee shot",
  "Approach",
  "Short game",
  "Putting",
  "Course management",
];
const emptyHole = (holeNumber: number): RoundHole => ({
  holeNumber,
  score: 0,
  focusCategory: "Approach" as FocusCategory,
  wentRight: "",
  wentWrong: "",
});
function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const [screen, setScreen] = useState<Screen>(
    () =>
      (localStorage.getItem("golf-tracker-screen") as Screen) || "distances",
  );
  const [selectedClub, setSelectedClub] = useState<ClubName>("7i");
  const [distanceInput, setDistanceInput] = useState("");
  const [playableInput, setPlayableInput] = useState(true);
  const [severeMissInput, setSevereMissInput] = useState(false);
  const distanceRef = useRef<HTMLInputElement>(null);
  const [roundDraft, setRoundDraft] = useState<
    AppData["rounds"][number] | null
  >(() => {
    try {
      const saved = localStorage.getItem("golf-tracker-round-draft");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [roundNotice, setRoundNotice] = useState("");
  useEffect(() => {
    localStorage.setItem("golf-tracker-screen", screen);
  }, [screen]);
  useEffect(() => {
    if (roundDraft)
      localStorage.setItem(
        "golf-tracker-round-draft",
        JSON.stringify(roundDraft),
      );
    else localStorage.removeItem("golf-tracker-round-draft");
  }, [roundDraft]);
  useEffect(() => {
    if (!supabase) {
      setCloudError("Supabase is not configured in this deployment.");
      setAuthReady(true);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data: auth }) => {
        setSession(auth.session);
        setAuthReady(true);
      })
      .catch((error) => {
        setCloudError(
          error instanceof Error
            ? error.message
            : "Could not connect to Supabase.",
        );
        setAuthReady(true);
      });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, authSession) => setSession(authSession),
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!authReady || !session) return;
    let cancelled = false;
    (async () => {
      const cloudData = await loadCloudData(session);
      if (!cancelled) {
        setData(cloudData || seedData());
        setDataReady(true);
      }
    })().catch((error) => {
      if (!cancelled)
        setCloudError(
          error instanceof Error
            ? error.message
            : "Could not load your Supabase data.",
        );
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, session]);
  useEffect(() => {
    if (!data || !dataReady || !session) return;
    saveCloudData(session, data).catch((error) =>
      setCloudError(
        error instanceof Error ? error.message : "Could not save to Supabase.",
      ),
    );
  }, [data, dataReady, session]);
  const currentHandicap = data?.handicapHistory.at(-1)?.index;
  const archivedRounds =
    data?.rounds.filter((round) => round.status === "archived") || [];
  const latestRound = archivedRounds.at(-1);
  const rec = personalisedRecommendation(
    data?.rounds || [],
    data?.readings || [],
  );
  if (!authReady)
    return <div className="loading">Connecting your notebook...</div>;
  if (cloudError && !session)
    return (
      <div className="loading">
        {cloudError}
        <br />
        <small>
          Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the GitHub Actions
          secrets.
        </small>
      </div>
    );
  if (isCloudConfigured && !session) return <AuthScreen />;
  if (!data) return <div className="loading">Loading your notebook...</div>;
  const updateData = (change: (current: AppData) => AppData) =>
    setData((current) => (current ? change(current) : current));
  const addReading = () => {
    const value = Number(distanceInput);
    if (!value || value <= 0) return;
    updateData((current) => ({
      ...current,
      readings: [
        ...current.readings,
        {
          id: crypto.randomUUID(),
          club: selectedClub,
          distanceMetres: Math.round(value),
          mishit: false,
          playable: playableInput,
          severeMiss: severeMissInput,
          sessionDate: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setDistanceInput("");
    distanceRef.current?.focus();
  };

  const startRound = () => {
    const unfinished = data.rounds.find(
      (round) => round.status === "in-progress",
    );
    const next = unfinished || {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      courseName: "Hermanus Golf Club",
      overallNote: "",
      status: "in-progress" as const,
      holes: [],
      loop: "east" as const,
      roundLength: 9 as const,
      tee: "white" as const,
    };
    setRoundDraft(next);
    setScreen("round");
  };
  const saveHole = (submittedHole?: RoundHole) => {
    if (!roundDraft) return null;
    const sequence = HERMANUS_LOOPS[roundDraft.loop || "east"].slice(
      0,
      roundDraft.roundLength || 9,
    );
    const holeNumber =
      submittedHole?.holeNumber ||
      sequence[Math.min(roundDraft.holes.length, sequence.length - 1)];
    const existing = roundDraft.holes.find(
      (hole) => hole.holeNumber === holeNumber,
    );
    const hole = submittedHole || existing || emptyHole(holeNumber);
    if (!hole.score) {
      setRoundNotice("Add a score before saving this hole.");
      return null;
    }
    const holes = existing
      ? roundDraft.holes.map((item) =>
          item.holeNumber === holeNumber ? hole : item,
        )
      : [...roundDraft.holes, hole];
    const updated = { ...roundDraft, holes };
    updateData((current) => ({
      ...current,
      rounds: current.rounds.some((round) => round.id === updated.id)
        ? current.rounds.map((round) =>
            round.id === updated.id ? updated : round,
          )
        : [...current.rounds, updated],
    }));
    setRoundDraft(updated);
    setRoundNotice("Saved");
    return updated;
  };
  const archiveRound = (source = roundDraft) => {
    if (!source) return;
    const updated = {
      ...source,
      status: "archived" as const,
      totalScore: roundTotal(source),
      archivedAt: new Date().toISOString(),
    };
    updateData((current) => ({
      ...current,
      rounds: current.rounds.map((round) =>
        round.id === updated.id ? updated : round,
      ),
      weeklyPlan:
        current.weeklyPlan.weekStart === startOfWeek()
          ? { ...current.weeklyPlan, roundComplete: true }
          : {
              weekStart: startOfWeek(),
              practiceAComplete: false,
              practiceBComplete: false,
              roundComplete: true,
            },
      weeklyHistory:
        current.weeklyPlan.weekStart === startOfWeek()
          ? current.weeklyHistory
          : [...(current.weeklyHistory || []), current.weeklyPlan],
    }));
    setRoundDraft(updated);
    setRoundNotice("Round archived");
    setScreen("progress");
  };
  const updatePlan = (
    key: "practiceAComplete" | "practiceBComplete" | "roundComplete",
  ) =>
    updateData((current) => {
      const week = startOfWeek();
      const history = current.weeklyHistory || [];
      const plan =
        current.weeklyPlan.weekStart === week
          ? current.weeklyPlan
          : {
              weekStart: week,
              practiceAComplete: false,
              practiceBComplete: false,
              roundComplete: false,
            };
      const completed = { ...plan, [key]: !plan[key] };
      const finished =
        completed.practiceAComplete &&
        completed.practiceBComplete &&
        completed.roundComplete;
      return finished
        ? {
            ...current,
            weeklyHistory: [...history, completed],
            weeklyPlan: {
              weekStart: week,
              practiceAComplete: false,
              practiceBComplete: false,
              roundComplete: false,
            },
          }
        : {
            ...current,
            weeklyHistory:
              current.weeklyPlan.weekStart === week
                ? history
                : [...history, current.weeklyPlan],
            weeklyPlan: completed,
          };
    });
  const recordHandicap = (roundId: string, index: number) =>
    updateData((current) => ({
      ...current,
      rounds: current.rounds.map((round) =>
        round.id === roundId ? { ...round, handicapIndex: index } : round,
      ),
      handicapHistory: [
        ...current.handicapHistory,
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          index,
          roundId,
        },
      ],
    }));
  const screenTitle =
    navItems.find((item) => item.id === screen)?.label || "Today";
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GOLF TRACKER</p>
          <h1>{screenTitle}</h1>
        </div>
        <button
          className="icon-button"
          title="Backup and restore"
          onClick={() => setScreen("settings")}
        >
          <Settings2 size={20} />
        </button>
      </header>
      <main className="main-content">
        {screen === "today" && (
          <Today
            data={data}
            currentHandicap={currentHandicap}
            latestRound={latestRound}
            recommendation={rec}
            go={setScreen}
            startRound={startRound}
            updatePlan={updatePlan}
          />
        )}
        {screen === "range" && (
          <Range
            data={data}
            units="metres"
            setUnits={() => undefined}
            selectedClub={selectedClub}
            setSelectedClub={setSelectedClub}
            distanceInput={distanceInput}
            setDistanceInput={setDistanceInput}
            distanceRef={distanceRef}
            addReading={addReading}
            playableInput={playableInput}
            setPlayableInput={setPlayableInput}
            severeMissInput={severeMissInput}
            setSevereMissInput={setSevereMissInput}
          />
        )}
        {screen === "distances" && (
          <Distances
            readings={data.readings}
            units="metres"
            setUnits={() => undefined}
          />
        )}
        {screen === "round" && (
          <RoundMode
            readings={data.readings}
            bag={data.bag}
            draft={roundDraft}
            setDraft={setRoundDraft}
            notice={roundNotice}
            setNotice={setRoundNotice}
            startRound={startRound}
            saveHole={saveHole}
            archiveRound={archiveRound}
          />
        )}
        {screen === "progress" && (
          <Progress
            data={data}
            recommendation={rec}
            updatePlan={updatePlan}
            recordHandicap={recordHandicap}
          />
        )}
        {screen === "settings" && (
          <Settings data={data} updateData={updateData} />
        )}
      </main>
      <nav className="bottom-nav">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={screen === id ? "active" : ""}
            onClick={() => setScreen(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setNotice("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) setNotice(error.message);
  };

  const signUp = async () => {
    if (!supabase) return;
    setBusy(true);
    setNotice("");
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    setNotice(
      error ? error.message : "Check your email to confirm your account.",
    );
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <span className="tag">GOLF TRACKER</span>
        <h2>Sign in to your distances.</h2>
        <p>
          Use the same account on your phone and computer. Your rows are
          protected by Supabase RLS.
        </p>
        <form onSubmit={signIn}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="primary-button" disabled={busy}>
            {busy ? "Connecting..." : "Sign in"}
          </button>
        </form>
        <button className="text-button" onClick={signUp} disabled={busy}>
          Create account
        </button>
        {notice && <p className="notice">{notice}</p>}
      </div>
    </div>
  );
}

function Today({
  data,
  currentHandicap,
  latestRound,
  recommendation: rec,
  go,
  startRound,
  updatePlan,
}: {
  data: AppData;
  currentHandicap?: number;
  latestRound?: AppData["rounds"][number];
  recommendation: ReturnType<typeof personalisedRecommendation>;
  go: (screen: Screen) => void;
  startRound: () => void;
  updatePlan: (
    key: "practiceAComplete" | "practiceBComplete" | "roundComplete",
  ) => void;
}) {
  const week = [
    data.weeklyPlan.practiceAComplete,
    data.weeklyPlan.practiceBComplete,
    data.weeklyPlan.roundComplete,
  ].filter(Boolean).length;
  return (
    <div className="stack fade-in today-screen">
      <section className="intro">
        <span className="eyebrow">PRACTICE FOCUS</span>
        <h2>{rec.text}</h2>
        <p>{rec.evidence}</p>
      </section>
      <div className="quick-grid">
        <button onClick={() => go("distances")}>
          <Gauge />
          <span>View distances</span>
          <ChevronRight />
        </button>
        <button onClick={() => go("range")}>
          <Target />
          <span>Start range session</span>
          <ChevronRight />
        </button>
        <button onClick={startRound}>
          <CircleDot />
          <span>Start a round</span>
          <ChevronRight />
        </button>
      </div>
      <section className="metric-grid">
        <div className="metric">
          <span>Handicap index</span>
          <strong>{currentHandicap ?? "No data"}</strong>
        </div>
        <div className="metric">
          <span>Latest round</span>
          <strong>{latestRound?.totalScore ?? "No round"}</strong>
        </div>
        <div className="metric">
          <span>This week</span>
          <strong>
            {week} <small>of {2 + 1}</small>
          </strong>
        </div>
      </section>
      <section className="panel feedback today-feedback">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LATEST FEEDBACK</span>
            <h3>{rec.text}</h3>
          </div>
          <Activity size={22} />
        </div>
        <p>
          {rec.evidence ||
            "Complete a nine-hole round with a quick note on each hole to unlock evidence-based feedback."}
        </p>
        {rec.priorities.length > 0 && (
          <div className="priority-list">
            {rec.priorities.slice(0, 3).map((priority) => (
              <div className="priority-item" key={priority.key}>
                <strong>{priority.drill}</strong>
                <small>{priority.evidence}</small>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="panel weekly">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THIS WEEK</span>
            <h3>{week} of 3 completed</h3>
          </div>
          <History size={22} />
        </div>
        {[
          [
            "practiceAComplete",
            rec.priorities[0]?.drill || "Play a round",
            rec.priorities[0]?.evidence ||
              "Record specific clubs and outcomes so your caddie can find your priorities",
          ],
          [
            "practiceBComplete",
            rec.priorities[1]?.drill || "Record distances at the range",
            rec.priorities[1]?.evidence ||
              "Build reliable club distances for better on-course decisions",
          ],
          ["roundComplete", "Round complete", "Play and reflect"],
        ].map(([key, title, detail]) => (
          <label className="plan-item" key={key}>
            <input
              type="checkbox"
              checked={
                data.weeklyPlan[key as keyof typeof data.weeklyPlan] as boolean
              }
              onChange={() =>
                updatePlan(
                  key as
                    "practiceAComplete" | "practiceBComplete" | "roundComplete",
                )
              }
            />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </label>
        ))}
      </section>
    </div>
  );
}

function Range({
  data,
  units,
  setUnits,
  selectedClub,
  setSelectedClub,
  distanceInput,
  setDistanceInput,
  distanceRef,
  addReading,
  playableInput,
  setPlayableInput,
  severeMissInput,
  setSevereMissInput,
}: {
  data: AppData;
  units: "metres" | "yards";
  setUnits: (units: "metres" | "yards") => void;
  selectedClub: ClubName;
  setSelectedClub: (club: ClubName) => void;
  distanceInput: string;
  setDistanceInput: (value: string) => void;
  distanceRef: React.RefObject<HTMLInputElement | null>;
  addReading: () => void;
  playableInput: boolean;
  setPlayableInput: (value: boolean) => void;
  severeMissInput: boolean;
  setSevereMissInput: (value: boolean) => void;
}) {
  const [clubPickerOpen, setClubPickerOpen] = useState(false);
  const summary = clubSummary(data.readings, selectedClub);
  const bag = data.bag?.length ? data.bag : CLUBS;
  return (
    <div className="stack fade-in range-screen">
      <section className="screen-lead">
        <span className="eyebrow">RANGE SESSION</span>
        <h2>Log the shot, keep moving.</h2>
      </section>
      <div className="unit-toggle">
        <button
          className={units === "metres" ? "selected" : ""}
          onClick={() => setUnits("metres")}
        >
          Metres
        </button>
        <button
          className={units === "yards" ? "selected" : ""}
          onClick={() => setUnits("yards")}
        >
          Yards
        </button>
      </div>
      <button
        className="club-picker-trigger"
        onClick={() => setClubPickerOpen(true)}
        aria-label="Choose club"
      >
        Club{" "}
        <strong>{selectedClub === "4W-Hybrid" ? "4H" : selectedClub}</strong>
        <span>▾</span>
      </button>
      {clubPickerOpen && (
        <div
          className="club-picker-backdrop"
          onClick={() => setClubPickerOpen(false)}
        >
          <section
            className="club-picker-sheet"
            role="dialog"
            aria-label="Choose club"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="section-heading">
              <h3>Choose club</h3>
              <button
                className="text-button"
                onClick={() => setClubPickerOpen(false)}
              >
                Done
              </button>
            </div>
            <div className="bag-picker-grid">
              {bag.map((club) => (
                <button
                  key={club}
                  className={selectedClub === club ? "selected" : ""}
                  onClick={() => {
                    setSelectedClub(club);
                    setClubPickerOpen(false);
                    setTimeout(() => distanceRef.current?.focus(), 0);
                  }}
                >
                  {club === "4W-Hybrid" ? "4H" : club}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      <section className="entry-panel">
        <div className="selected-carry">
          <span>
            {selectedClub === "4W-Hybrid" ? "4H" : selectedClub} · typical carry
          </span>
          <strong>
            {summary.typical
              ? `${convertMetres(summary.typical, units)} ${units === "metres" ? "m" : "yd"}`
              : "No estimate"}
          </strong>
          <small>
            <>
              {summary.playablePercentage ?? 0}% playable ·{" "}
              {summary.severeMissPercentage ?? 0}% severe miss
            </>{" "}
            ·{" "}
            {summary.usableCount < 5
              ? "early estimate"
              : `${summary.usableCount} usable readings`}
          </small>
        </div>
        <div className="range-log-row">
          <label className="distance-label">Distance</label>
          <input
            ref={distanceRef}
            inputMode="decimal"
            value={distanceInput}
            onChange={(event) => setDistanceInput(event.target.value)}
            placeholder=""
            aria-label="Distance"
            onKeyDown={(event) => event.key === "Enter" && addReading()}
          />
          <button
            className={`range-toggle playable-toggle ${playableInput ? "yes" : "no"}`}
            aria-label={`Playable: ${playableInput ? "yes" : "no"}. Tap to change.`}
            onClick={() => setPlayableInput(!playableInput)}
          >
            {playableInput ? "Playable: Yes" : "Playable: No"}
          </button>
          <button
            className={`range-toggle severe-toggle ${severeMissInput ? "yes" : "no"}`}
            aria-label={`Severe miss: ${severeMissInput ? "yes" : "no"}. Tap to change.`}
            onClick={() => setSevereMissInput(!severeMissInput)}
          >
            {severeMissInput ? "Severe miss: Yes" : "Severe miss: No"}
          </button>
          <button className="primary-button" onClick={addReading}>
            <Plus size={18} />
            Save
          </button>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{selectedClub} READINGS</span>
            <h3>
              {summary.usableCount
                ? `${convertMetres(summary.min!, units)}–${convertMetres(summary.max!, units)} ${units === "metres" ? "m" : "yd"}`
                : "No readings yet"}
            </h3>
          </div>
          <span className="count-pill">
            {summary.playablePercentage ?? 0}% playable
          </span>
        </div>
        <div className="reading-list">
          {summary.readings.slice(0, 8).map((reading) => (
            <div className="reading" key={reading.id}>
              <span>
                {convertMetres(reading.distanceMetres, units)}{" "}
                {units === "metres" ? "m" : "yd"}{" "}
                {reading.playable === false && <em>not playable</em>}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Distances({
  readings,
  units,
  setUnits,
}: {
  readings: AppData["readings"];
  units: "metres" | "yards";
  setUnits: (units: "metres" | "yards") => void;
}) {
  const [expandedClub, setExpandedClub] = useState<ClubName | null>(null);
  return (
    <div className="stack distances-screen fade-in">
      <div className="sticky-tools">
        <div>
          <span className="eyebrow">ON-COURSE QUICK REFERENCE</span>
          <h2>My distances</h2>
        </div>
        <div className="unit-toggle">
          <button
            className={units === "metres" ? "selected" : ""}
            onClick={() => setUnits("metres")}
          >
            m
          </button>
          <button
            className={units === "yards" ? "selected" : ""}
            onClick={() => setUnits("yards")}
          >
            yd
          </button>
        </div>
      </div>
      <div className="distance-legend">
        <span>✓ Playable</span>
        <span>⚠ Severe</span>
      </div>
      <div className="distance-board">
        {DISTANCE_CLUBS.map((club) => {
          const summary = clubSummary(readings, club);
          return (
            <button
              className={`distance-card ${expandedClub === club ? "expanded" : ""}`}
              key={club}
              onClick={() =>
                setExpandedClub(expandedClub === club ? null : club)
              }
            >
              <strong>{club}</strong>
              {summary.typical ? (
                <>
                  <b>
                    {convertMetres(summary.typical, units)}{" "}
                    <small>{units === "metres" ? "m" : "yd"}</small>
                  </b>
                  <span>
                    {convertMetres(summary.min!, units)}–
                    {convertMetres(summary.max!, units)}{" "}
                    {units === "metres" ? "m" : "yd"}
                  </span>
                  <span className="distance-reliability">
                    <span className="playable-mark">
                      ✓ {summary.playablePercentage ?? 0}%
                    </span>
                    <span
                      className={
                        (summary.severeMissPercentage || 0) > 0
                          ? "severe-mark warning"
                          : "severe-mark"
                      }
                    >
                      ⚠ {summary.severeMissPercentage ?? 0}%
                    </span>
                  </span>
                  {expandedClub === club && (
                    <small className="distance-detail">
                      {summary.usableCount} shots ·{" "}
                      {summary.playablePercentage ?? 0}% playable ·{" "}
                      {summary.severeMissPercentage ?? 0}% severe
                    </small>
                  )}
                </>
              ) : (
                <span className="empty">No readings yet</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniLineChart({ values }: { values: number[] }) {
  if (!values.length)
    return (
      <div className="chart-empty">Complete a round to see your trend.</div>
    );
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const points = values
    .map(
      (value, index) =>
        `${values.length === 1 ? 50 : (index / (values.length - 1)) * 100},${100 - ((value - min) / (max - min || 1)) * 80 - 10}`,
    )
    .join(" ");
  return (
    <svg
      className="mini-chart"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label="Round score trend"
    >
      <path className="chart-gridline" d="M0 25H100M0 50H100M0 75H100" />
      <polyline points={points} />
      <circle
        cx={points.split(" ").at(-1)?.split(",")[0]}
        cy={points.split(" ").at(-1)?.split(",")[1]}
        r="2.4"
      />
    </svg>
  );
}

function ClubTrendChart({
  values,
  label,
  suffix = "%",
}: {
  values: number[];
  label: string;
  suffix?: string;
}) {
  return (
    <div className="club-trend-line">
      <div className="club-trend-line-label">
        <span>{label}</span>
        <b>
          {values.at(-1) === undefined
            ? "—"
            : `${Math.round(values.at(-1)!)}${suffix}`}
        </b>
      </div>
      <MiniLineChart values={values} />
    </div>
  );
}

function ClubFormPanel({ readings }: { readings: AppData["readings"] }) {
  const clubs = DISTANCE_CLUBS.filter((club) =>
    readings.some((reading) => reading.club === club),
  );
  const [selectedClub, setSelectedClub] = useState<ClubName>(clubs[0] || "7i");
  const club = clubs.includes(selectedClub) ? selectedClub : clubs[0];
  const clubReadings = club
    ? readings
        .filter((reading) => reading.club === club)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];
  const carryTrend = clubReadings.map(
    (_, index) =>
      clubReadings
        .slice(0, index + 1)
        .reduce((sum, reading) => sum + reading.distanceMetres, 0) /
      (index + 1),
  );
  const playableTrend = clubReadings.map(
    (_, index) =>
      (clubReadings
        .slice(0, index + 1)
        .filter((reading) => reading.playable !== false).length /
        (index + 1)) *
      100,
  );
  const severeMissTrend = clubReadings.map(
    (_, index) =>
      (clubReadings
        .slice(0, index + 1)
        .filter((reading) => reading.severeMiss === true).length /
        (index + 1)) *
      100,
  );
  const average = carryTrend.at(-1);
  const change = carryTrend.length > 1 ? average! - carryTrend[0] : undefined;
  return (
    <section className="panel club-form-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CLUB CONTROL</span>
          <h3>How your form is moving</h3>
        </div>
        <Gauge size={22} />
      </div>
      {clubs.length ? (
        <>
          <div
            className="club-selector"
            role="tablist"
            aria-label="Select club"
          >
            {clubs.map((item) => (
              <button
                key={item}
                className={item === club ? "selected" : ""}
                onClick={() => setSelectedClub(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="club-trend-summary">
            <div>
              <span>Average carry</span>
              <strong>{Math.round(average!)} m</strong>
            </div>
            <div>
              <span>Average change</span>
              <strong
                className={change !== undefined && change < 0 ? "down" : ""}
              >
                {change === undefined
                  ? "—"
                  : `${change > 0 ? "+" : ""}${Math.round(change)} m`}
              </strong>
            </div>
            <small>{clubReadings.length} shots · cumulative trend</small>
          </div>
          <div className="club-trend-chart">
            <ClubTrendChart
              values={carryTrend}
              label="Average carry"
              suffix=" m"
            />
            <ClubTrendChart values={playableTrend} label="Playable" />
            <ClubTrendChart values={severeMissTrend} label="Severe miss" />
          </div>
          <p className="chart-caption">
            Cumulative trends show whether this club is becoming more
            predictable over time.
          </p>
        </>
      ) : (
        <p>Log range shots to see your club form trend.</p>
      )}
    </section>
  );
}

export function LegacyClubFormPanel({
  readings,
}: {
  readings: AppData["readings"];
}) {
  const clubs = DISTANCE_CLUBS.filter((club) =>
    readings.some((reading) => reading.club === club),
  );
  const [selectedClub, setSelectedClub] = useState<ClubName>(clubs[0] || "7i");
  const club = clubs.includes(selectedClub) ? selectedClub : clubs[0];
  const points = club
    ? readings
        .filter((reading) => reading.club === club)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((reading) => reading.distanceMetres)
    : [];
  const recent = points.at(-1);
  const change = points.length > 1 ? recent! - points[0] : undefined;
  return (
    <section className="panel club-form-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CLUB CONTROL</span>
          <h3>How your form is moving</h3>
        </div>
        <Gauge size={22} />
      </div>
      {clubs.length ? (
        <>
          <div
            className="club-selector"
            role="tablist"
            aria-label="Select club"
          >
            {clubs.map((item) => (
              <button
                key={item}
                className={item === club ? "selected" : ""}
                onClick={() => setSelectedClub(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="club-trend-summary">
            <div>
              <span>Latest carry</span>
              <strong>{recent} m</strong>
            </div>
            <div>
              <span>Trend</span>
              <strong
                className={change !== undefined && change < 0 ? "down" : ""}
              >
                {change === undefined
                  ? "—"
                  : `${change > 0 ? "+" : ""}${change} m`}
              </strong>
            </div>
            <small>{points.length} shots · newest readings on the right</small>
          </div>
          <div className="club-trend-chart">
            <MiniLineChart values={points} />
          </div>
          <p className="chart-caption">
            Use the trend to see whether contact and carry are becoming more
            repeatable. Miss and playable rates live in My distances.
          </p>
        </>
      ) : (
        <p>Log range shots to see your club form trend.</p>
      )}
    </section>
  );
}

function Settings({
  data,
  updateData,
}: {
  data: AppData;
  updateData: (change: (current: AppData) => AppData) => void;
}) {
  const bag = data.bag || [...CLUBS, "Putter"];
  const available = [...new Set([...CLUBS, "5W", "Putter", "2i", "3i", "4i"])];
  const toggleClub = (club: string) =>
    updateData((current) => ({
      ...current,
      bag: (current.bag || bag).includes(club)
        ? (current.bag || bag).filter((item) => item !== club)
        : [...(current.bag || bag), club],
    }));
  const updateFrequency = (
    key: "roundsPerWeek" | "practiceSessionsPerWeek",
    value: number,
  ) =>
    updateData((current) => ({
      ...current,
      practiceFrequency: {
        roundsPerWeek: current.practiceFrequency?.roundsPerWeek || 1,
        practiceSessionsPerWeek:
          current.practiceFrequency?.practiceSessionsPerWeek || 2,
        [key]: value,
      },
    }));
  return (
    <div className="stack fade-in">
      <section className="screen-lead">
        <span className="eyebrow">YOUR SETUP</span>
        <h2>Make the tracker yours.</h2>
        <p>Set your practice rhythm and build the bag you actually play.</p>
      </section>
      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PRACTICE RHYTHM</span>
            <h3>How often do you want to practise?</h3>
          </div>
        </div>
        <label className="settings-field">
          Rounds per week
          <input
            type="number"
            min="0"
            max="7"
            value={data.practiceFrequency?.roundsPerWeek ?? 1}
            onChange={(event) =>
              updateFrequency("roundsPerWeek", Number(event.target.value))
            }
          />
        </label>
        <p className="settings-copy">
          Sessions are named automatically from your current issues and goals.
          Use Settings to control how often you practise; the caddie chooses the
          work.
        </p>
        <label className="settings-field">
          Practice sessions per week
          <input
            type="number"
            min="0"
            max="14"
            value={data.practiceFrequency?.practiceSessionsPerWeek ?? 2}
            onChange={(event) =>
              updateFrequency(
                "practiceSessionsPerWeek",
                Number(event.target.value),
              )
            }
          />
        </label>
      </section>
      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">GOLF BAG</span>
            <h3>Clubs you carry</h3>
          </div>
          <span className="count-pill">{bag.length} clubs</span>
        </div>
        <p className="settings-copy">
          Your bag controls the clubs available during round entry and future
          recommendations.
        </p>
        <div className="bag-grid">
          {available.map((club) => (
            <button
              type="button"
              key={club}
              className={bag.includes(club) ? "selected" : ""}
              onClick={() => toggleClub(club)}
            >
              {club}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Progress({
  data,
  recommendation: rec,
  updatePlan,
  recordHandicap,
}: {
  data: AppData;
  recommendation: ReturnType<typeof personalisedRecommendation>;
  updatePlan: (
    key: "practiceAComplete" | "practiceBComplete" | "roundComplete",
  ) => void;
  recordHandicap: (roundId: string, index: number) => void;
}) {
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [showIssueBreakdown, setShowIssueBreakdown] = useState(false);
  const [insightsTab, setInsightsTab] = useState<
    "overview" | "clubs" | "rounds"
  >("overview");
  const archived = data.rounds
    .filter((round) => round.status === "archived")
    .sort((a, b) => a.date.localeCompare(b.date));
  const recent = archived.slice(-6);
  const completed = [
    data.weeklyPlan.practiceAComplete,
    data.weeklyPlan.practiceBComplete,
    data.weeklyPlan.roundComplete,
  ].filter(Boolean).length;
  const scores = recent.map((round) => round.totalScore || roundTotal(round));
  const holes = recent.flatMap((round) => round.holes);
  const categories: FocusCategory[] = [
    "Tee shot",
    "Approach",
    "Short game",
    "Putting",
    "Course management",
  ];
  const categoryStats = categories.map((category) => {
    const items = holes.filter((hole) => hole.focusCategory === category);
    return {
      category,
      average: items.length
        ? items.reduce((sum, hole) => sum + hole.score, 0) / items.length
        : 0,
      count: items.length,
      trouble: items.filter(
        (hole) =>
          hole.wentWrong.trim() ||
          (hole.tags || []).some((tag) => tag.type === "went-wrong"),
      ).length,
    };
  });
  const maxTrouble = Math.max(...categoryStats.map((item) => item.trouble), 1);
  const issues = holes.flatMap((hole) =>
    (hole.tags || [])
      .filter((tag) => tag.type === "went-wrong")
      .map((tag) => tag.outcome),
  );
  const issueCounts = Object.entries(
    issues.reduce<Record<string, number>>(
      (all, issue) => ({ ...all, [issue]: (all[issue] || 0) + 1 }),
      {},
    ),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const clubStats = DISTANCE_CLUBS.map((club) => {
    const readings = data.readings.filter((reading) => reading.club === club);
    const usable = readings.filter((reading) => !reading.severeMiss);
    const distances = usable.map((reading) => reading.distanceMetres);
    const average = distances.length
      ? distances.reduce((sum, value) => sum + value, 0) / distances.length
      : 0;
    const dispersion = distances.length
      ? Math.max(...distances) - Math.min(...distances)
      : 0;
    return {
      club,
      count: readings.length,
      average,
      dispersion,
      playable: readings.length
        ? Math.round(
            (readings.filter((reading) => reading.playable !== false).length /
              readings.length) *
              100,
          )
        : 0,
      severe: readings.length
        ? Math.round(
            (readings.filter((reading) => reading.severeMiss === true).length /
              readings.length) *
              100,
          )
        : 0,
    };
  }).filter((item) => item.count);
  const maxDispersion = Math.max(
    ...clubStats.map((item) => item.dispersion),
    1,
  );
  const handicapValues = data.handicapHistory
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8)
    .map((item) => item.index);
  const latest = scores.at(-1);
  const previous = scores.length > 1 ? scores.at(-2) : undefined;
  const scoreDelta =
    latest !== undefined && previous !== undefined
      ? latest - previous
      : undefined;
  const selectedRound = selectedRoundId
    ? archived.find((round) => round.id === selectedRoundId)
    : undefined;
  if (selectedRound)
    return (
      <RoundDetail
        round={selectedRound}
        onBack={() => setSelectedRoundId(null)}
      />
    );
  return (
    <div className={`stack fade-in insights-screen insights-${insightsTab}`}>
      <section className="screen-lead">
        <span className="eyebrow">THE LONG VIEW</span>
        <h2>What is changing in your game?</h2>
        <p>Scoring, leaks, and the next thing to practise.</p>
      </section>
      <div
        className="insights-tabs"
        role="tablist"
        aria-label="Insights sections"
      >
        <button
          className={insightsTab === "overview" ? "selected" : ""}
          onClick={() => setInsightsTab("overview")}
        >
          Overview
        </button>
        <button
          className={insightsTab === "clubs" ? "selected" : ""}
          onClick={() => setInsightsTab("clubs")}
        >
          Clubs
        </button>
        <button
          className={insightsTab === "rounds" ? "selected" : ""}
          onClick={() => setInsightsTab("rounds")}
        >
          Rounds
        </button>
      </div>
      <section className="analytics-hero">
        <div>
          <span className="eyebrow">ROUND TREND</span>
          <strong>{latest ?? "—"}</strong>
          <span>
            {scoreDelta === undefined
              ? "First round logged"
              : `${scoreDelta > 0 ? "+" : ""}${scoreDelta} vs previous round`}
          </span>
        </div>
        <div className="hero-chart">
          <MiniLineChart values={scores} />
        </div>
      </section>
      <div className="metric-grid analytics-metrics">
        <div className="metric">
          <span>Rounds logged</span>
          <strong>{archived.length}</strong>
        </div>
        <div className="metric">
          <span>Holes tracked</span>
          <strong>{holes.length}</strong>
        </div>
        <div className="metric">
          <span>Current index</span>
          <strong>{data.handicapHistory.at(-1)?.index ?? "—"}</strong>
        </div>
      </div>
      <section className="panel handicap-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HANDICAP INDEX</span>
            <h3>{data.handicapHistory.at(-1)?.index ?? "—"} current index</h3>
          </div>
          <span className="count-pill">{handicapValues.length} updates</span>
        </div>
        <MiniLineChart values={handicapValues} />
      </section>
      <ClubFormPanel readings={data.readings} />
      <section className="legacy-club-control panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CLUB CONTROL</span>
            <h3>Distance & dispersion</h3>
          </div>
          <Gauge size={22} />
        </div>
        {clubStats.length ? (
          <div className="club-analytics">
            {clubStats.map((item) => (
              <div className="club-analytics-row" key={item.club}>
                <div className="club-label">
                  <strong>{item.club}</strong>
                  <small>
                    {Math.round(item.average)} m avg · {item.dispersion} m
                    spread
                  </small>
                </div>
                <div className="club-stat">
                  <span>
                    Playable <b>{item.playable}%</b>
                  </span>
                  <i>
                    <em style={{ width: `${item.playable}%` }} />
                  </i>
                </div>
                <div className="club-stat">
                  <span>
                    Severe miss <b>{item.severe}%</b>
                  </span>
                  <i className="risk">
                    <em style={{ width: `${item.severe || 2}%` }} />
                  </i>
                </div>
                <div className="dispersion-track">
                  <span
                    style={{
                      width: `${(item.dispersion / maxDispersion) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>Log range shots to see carry, dispersion, and playable rates.</p>
        )}
      </section>
      <section className="panel insights-form-map">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FORM MAP</span>
            <h3>Where shots cost you</h3>
          </div>
          <Target size={22} />
        </div>
        <div className="form-list">
          {categoryStats.map((item) => (
            <div className="form-row" key={item.category}>
              <div>
                <strong>{item.category}</strong>
                <small>
                  {item.count
                    ? `${item.trouble} trouble hole${item.trouble === 1 ? "" : "s"} · ${item.average.toFixed(1)} avg`
                    : "No data yet"}
                </small>
              </div>
              <div className="form-bar">
                <span
                  style={{ width: `${(item.trouble / maxTrouble) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel insights-leaks">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PRACTICE FOCUS</span>
            <h3>{rec.text}</h3>
          </div>
          <Activity size={22} />
        </div>
        <button
          className="issue-disclosure"
          onClick={() => setShowIssueBreakdown(!showIssueBreakdown)}
        >
          View issue breakdown {showIssueBreakdown ? "↑" : "→"}
        </button>
        {showIssueBreakdown && issueCounts.length > 0 && (
          <div className="issue-list">
            {issueCounts.map(([issue, count]) => (
              <div className="issue-row" key={issue}>
                <span>{issue}</span>
                <b>{count}</b>
              </div>
            ))}
          </div>
        )}
        <div className="recommendation">
          <span className="eyebrow">EVIDENCE</span>
          <strong>{rec.text}</strong>
          <p>{rec.evidence}</p>
        </div>
      </section>
      <section className="panel weekly progress-weekly insights-weekly">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THIS WEEK</span>
            <h3>
              {completed} of {2 + 1} completed
            </h3>
          </div>
          <History size={22} />
        </div>
        {[
          [
            "practiceAComplete",
            rec.priorities[0]?.drill || "Play a round",
            rec.priorities[0]?.evidence ||
              "Record specific clubs and outcomes so your caddie can find your priorities",
          ],
          [
            "practiceBComplete",
            rec.priorities[1]?.drill || "Record distances at the range",
            rec.priorities[1]?.evidence ||
              "Build reliable club distances for better on-course decisions",
          ],
          ["roundComplete", "Round complete", "Play and reflect"],
        ].map(([key, title, detail]) => (
          <label className="plan-item" key={key}>
            <input
              type="checkbox"
              checked={
                data.weeklyPlan[key as keyof typeof data.weeklyPlan] as boolean
              }
              onChange={() =>
                updatePlan(
                  key as
                    "practiceAComplete" | "practiceBComplete" | "roundComplete",
                )
              }
            />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </label>
        ))}
      </section>
      <section className="panel insights-history">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ROUND JOURNAL</span>
            <h3>{archived.length} archived rounds</h3>
          </div>
          <Archive size={22} />
        </div>
        {archived.length ? (
          archived
            .slice()
            .reverse()
            .map((round) => (
              <div
                className={`journal-row round-row ${selectedRoundId === round.id ? "selected" : ""}`}
                key={round.id}
                onClick={() =>
                  setSelectedRoundId(
                    selectedRoundId === round.id ? null : round.id,
                  )
                }
                role="button"
                tabIndex={0}
                onKeyDown={(event) =>
                  event.key === "Enter" &&
                  setSelectedRoundId(
                    selectedRoundId === round.id ? null : round.id,
                  )
                }
              >
                <div>
                  <strong>{formatDate(round.date)}</strong>
                  <span>{round.courseName || "Local round"}</span>
                  <input
                    className="index-input"
                    type="number"
                    step="0.1"
                    placeholder={
                      round.handicapIndex
                        ? String(round.handicapIndex)
                        : "Official index"
                    }
                    onBlur={(event) => (
                      event.stopPropagation(),
                      event.target.value &&
                        recordHandicap(round.id, Number(event.target.value))
                    )}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
                <b>{round.totalScore || roundTotal(round)}</b>
              </div>
            ))
        ) : (
          <p>No archived rounds yet.</p>
        )}
        {selectedRoundId &&
          data.rounds.find((round) => round.id === selectedRoundId) && (
            <ArchivedScorecard
              round={data.rounds.find((round) => round.id === selectedRoundId)!}
            />
          )}
      </section>
    </div>
  );
}

function RoundDetail({
  round,
  onBack,
}: {
  round: AppData["rounds"][number];
  onBack: () => void;
}) {
  const score = round.totalScore || roundTotal(round);
  const par = round.holes.reduce(
    (total, hole) => total + holePar(hole.holeNumber),
    0,
  );
  const issues = round.holes.flatMap((hole) =>
    (hole.tags || [])
      .filter((tag) => tag.type === "went-wrong")
      .map((tag) => tag.outcome),
  );
  return (
    <div className="stack fade-in round-detail-screen">
      <button className="text-button" onClick={onBack}>
        ← Back to Insights
      </button>
      <section className="screen-lead">
        <span className="eyebrow">ROUND DETAILS</span>
        <h2>{round.courseName}</h2>
        <p>
          {formatDate(round.date)} ·{" "}
          {round.loop ? loopLabel(round.loop) : "Round"}
        </p>
      </section>
      <section className="detail-score">
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div>
          <span>Score to par</span>
          <strong>
            {par ? `${score - par > 0 ? "+" : ""}${score - par}` : "—"}
          </strong>
        </div>
        <div>
          <span>Handicap</span>
          <strong>{round.handicapIndex ?? "—"}</strong>
        </div>
      </section>
      {issues.length > 0 && (
        <section className="panel">
          <span className="eyebrow">ROUND FEEDBACK</span>
          <h3>Main leaks</h3>
          <p>{Array.from(new Set(issues)).join(" · ")}</p>
        </section>
      )}
      <ArchivedScorecard round={round} />
    </div>
  );
}

function ArchivedScorecard({ round }: { round: AppData["rounds"][number] }) {
  const orderedHoles = [...round.holes].sort(
    (a, b) => a.holeNumber - b.holeNumber,
  );
  return (
    <section className="scorecard">
      <div className="scorecard-heading">
        <div>
          <span className="eyebrow">SCORECARD</span>
          <h3>
            {loopLabel(round.loop || "east")} · {round.tee || "white"} tees
          </h3>
        </div>
        <strong>{round.totalScore || roundTotal(round)}</strong>
      </div>
      <div className="scorecard-table">
        <div className="scorecard-row scorecard-label">
          <span>Hole</span>
          <span>Par</span>
          <span>Score</span>
          <span>Feedback</span>
        </div>
        {orderedHoles.map((hole) => {
          const right = [
            ...(hole.tags || [])
              .filter((tag) => tag.type === "went-right")
              .map((tag) => tag.outcome),
            hole.wentRight,
          ].filter(Boolean);
          const wrong = [
            ...(hole.tags || [])
              .filter((tag) => tag.type === "went-wrong")
              .map((tag) => tag.outcome),
            hole.wentWrong,
          ].filter(Boolean);
          const shotFeedback = (hole.shots || [])
            .filter((shot) => shot.outcome)
            .map(
              (shot) =>
                `${shot.phase === "short-game" ? "Short game" : shot.phase[0].toUpperCase() + shot.phase.slice(1)}: ${shot.club} (${shot.outcome === "good" ? "went well" : "needs work"})`,
            );
          return (
            <div className="scorecard-row" key={hole.holeNumber}>
              <span className="scorecard-hole">{hole.holeNumber}</span>
              <span>{holePar(hole.holeNumber)}</span>
              <strong
                className={
                  hole.score < holePar(hole.holeNumber)
                    ? "under"
                    : hole.score > holePar(hole.holeNumber)
                      ? "over"
                      : "even"
                }
              >
                {hole.score}
              </strong>
              <div className="scorecard-feedback">
                {right.length > 0 && (
                  <small className="right">
                    ✓ {Array.from(new Set(right)).join(", ")}
                  </small>
                )}
                {wrong.length > 0 && (
                  <small className="wrong">
                    × {Array.from(new Set(wrong)).join(", ")}
                  </small>
                )}
                {shotFeedback.map((item) => (
                  <small
                    key={item}
                    className={item.includes("needs work") ? "wrong" : "right"}
                  >
                    • {item}
                  </small>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RoundMode({
  readings,
  bag,
  draft,
  setDraft,
  notice,
  startRound,
  saveHole,
  archiveRound,
}: {
  readings: AppData["readings"];
  bag?: ClubName[];
  draft: AppData["rounds"][number] | null;
  setDraft: (round: AppData["rounds"][number]) => void;
  notice: string;
  setNotice: (notice: string) => void;
  startRound: () => void;
  saveHole: (hole?: RoundHole) => AppData["rounds"][number] | null;
  archiveRound: (round?: AppData["rounds"][number] | null) => void;
}) {
  const [activeHole, setActiveHole] = useState(0);
  const [courseOpen, setCourseOpen] = useState(false);
  if (!draft)
    return (
      <div className="empty-state fade-in">
        <CircleDot size={34} />
        <h2>One hole at a time.</h2>
        <p>Start a Hermanus round and keep the notes short.</p>
        <button className="primary-button" onClick={startRound}>
          Start round
        </button>
      </div>
    );
  const loop = draft.loop || "east";
  const length = draft.roundLength || 9;
  const holes = HERMANUS_LOOPS[loop].slice(0, length);
  const index = Math.min(activeHole, holes.length - 1);
  const holeNumber = holes[index];
  const currentHole =
    draft.holes.find((hole) => hole.holeNumber === holeNumber) ||
    emptyHole(holeNumber);
  const completed = draft.holes.length;
  const update = (patch: Partial<typeof draft>) => {
    setActiveHole(0);
    setDraft({ ...draft, ...patch });
  };
  const updateHole = (patch: Partial<typeof currentHole>) =>
    setDraft({
      ...draft,
      holes: [
        ...draft.holes.filter((hole) => hole.holeNumber !== holeNumber),
        { ...currentHole, ...patch },
      ].sort(
        (a, b) => holes.indexOf(a.holeNumber) - holes.indexOf(b.holeNumber),
      ),
    });
  return (
    <div className="stack fade-in round-screen">
      {completed === 0 && (
        <section className="round-setup">
          <span className="eyebrow">HERMANUS GOLF CLUB</span>
          <div className="setup-grid">
            <label>
              Loop
              <select
                value={loop}
                onChange={(e) =>
                  update({ loop: e.target.value as typeof loop, holes: [] })
                }
              >
                {(["east", "north", "south"] as const).map((item) => (
                  <option key={item} value={item}>
                    {loopLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Round
              <select
                value={length}
                onChange={(e) =>
                  update({ roundLength: Number(e.target.value), holes: [] })
                }
              >
                {[3, 6, 9, 12, 18].map((count) => (
                  <option key={count} value={count}>
                    {count} holes
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tee
              <select
                value={draft.tee || "white"}
                onChange={(e) =>
                  update({ tee: e.target.value as "white" | "yellow" | "red" })
                }
              >
                <option value="white">Whites</option>
                <option value="yellow">Yellows</option>
                <option value="red">Reds</option>
              </select>
            </label>
          </div>
        </section>
      )}
      <div className="compact-hole-header">
        <strong>Hole {holeNumber}</strong>
        <span>Par {holePar(holeNumber)}</span>
        <span>{holeDistance(holeNumber, draft.tee || "white")}m</span>
        <small>
          {completed}/{length}
        </small>
      </div>
      <div className="compact-caddie-row">
        <button
          type="button"
          className="course-toggle"
          onClick={() => setCourseOpen(!courseOpen)}
        >
          {courseOpen ? "Course ↑" : "Course"}
        </button>
        <Caddie
          readings={readings}
          par={holePar(holeNumber)}
          distance={holeDistance(holeNumber, draft.tee || "white")}
        />
        {courseOpen && (
          <div className="map-wrap compact-map">
            <pre className="hole-diagram">
              {HERMANUS_HOLE_DIAGRAMS[holeNumber]}
            </pre>
          </div>
        )}
      </div>
      <section className="hole-form">
        <label>
          Score
          <div className="score-entry">
            <div className="score-stepper">
              <button
                type="button"
                aria-label="Decrease score"
                onClick={() =>
                  updateHole({
                    score: Math.max(
                      1,
                      (currentHole.score || holePar(holeNumber)) - 1,
                    ),
                  })
                }
              >
                −
              </button>
              <strong>{currentHole.score || holePar(holeNumber)}</strong>
              <button
                type="button"
                aria-label="Increase score"
                onClick={() =>
                  updateHole({
                    score: Math.min(
                      15,
                      (currentHole.score || holePar(holeNumber)) + 1,
                    ),
                  })
                }
              >
                +
              </button>
            </div>
          </div>
        </label>
        <label>
          Main area
          <select
            value={currentHole.focusCategory}
            onChange={(event) =>
              updateHole({ focusCategory: event.target.value as FocusCategory })
            }
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <ShotGroups
          bag={bag}
          shots={currentHole.shots || []}
          setShots={(shots) => updateHole({ shots })}
        />
      </section>
      <button
        className="primary-button save-hole"
        onClick={() => {
          if (completed >= length) archiveRound();
          else {
            const saved = saveHole({
              ...currentHole,
              score: currentHole.score || holePar(holeNumber),
            });
            if (!saved) return;
            if (saved.holes.length >= length) archiveRound(saved);
            else setActiveHole(Math.min(index + 1, holes.length - 1));
          }
        }}
      >
        <Save size={18} />
        {completed >= length ? "Finish round" : "Save hole →"}
      </button>
      {notice && (
        <p className="notice">
          <Check size={16} />
          {notice}
        </p>
      )}
      <div className="hole-strip">
        {holes.map((hole, i) => (
          <button
            key={hole}
            className={i === index ? "active" : ""}
            onClick={() => setActiveHole(i)}
          >
            {hole}
          </button>
        ))}
      </div>
    </div>
  );
}

function Caddie({
  readings,
  par,
  distance,
}: {
  readings: AppData["readings"];
  par: number;
  distance: number;
}) {
  const plan = caddiePlan(readings, par, distance);
  if (!plan) return null;
  return (
    <section className="caddie">
      <span className="caddie-title">CADDIE</span>
      <span className="eyebrow">PLAN</span>
      <b>{plan.sequence.map((item) => item.club).join(" → ")}</b>
    </section>
  );
}

function ShotGroups({
  bag,
  shots,
  setShots,
}: {
  bag?: ClubName[];
  shots: HoleShot[];
  setShots: (shots: HoleShot[]) => void;
}) {
  const [activePhase, setActivePhase] = useState<ShotPhase | null>(null);
  const outcomeOptions: Record<ShotPhase, { good: string[]; bad: string[] }> = {
    tee: {
      good: ["Fairway found", "Good contact", "Good distance", "Good decision"],
      bad: [
        "Slice",
        "Hook",
        "Missed left",
        "Missed right",
        "Top",
        "Poor contact",
        "Bad decision",
      ],
    },
    approach: {
      good: ["Hit green", "Good contact", "Good distance", "Good direction"],
      bad: [
        "Short",
        "Long",
        "Left",
        "Right",
        "Fat",
        "Thin",
        "Topped",
        "Wrong club",
      ],
    },
    "short-game": {
      good: [
        "Good chip on",
        "Good direction",
        "Good distance",
        "Up-and-down",
        "Good recovery",
      ],
      bad: [
        "Chunked",
        "Thinned",
        "Too short",
        "Too long",
        "Poor direction",
        "Poor lie",
      ],
    },
    putting: {
      good: ["Good read", "Good speed", "Holed putt", "Good lag"],
      bad: [
        "Bad read",
        "Too short",
        "Too long",
        "Pushed",
        "Pulled",
        "Three-putt",
        "Missed short putt",
      ],
    },
  };
  const clubs = bag || [...CLUBS, "Putter"];
  const groups: Array<{ phase: ShotPhase; label: string; clubs: string[] }> = [
    {
      phase: "tee",
      label: "Tee club",
      clubs: clubs.filter((club) => !["PW", "SW", "Putter"].includes(club)),
    },
    {
      phase: "approach",
      label: "Approach",
      clubs: clubs.filter((club) => club !== "Putter"),
    },
    {
      phase: "short-game",
      label: "Short game",
      clubs: clubs.filter(
        (club) =>
          ["PW", "SW"].includes(club) ||
          ![
            "Dr",
            "3W",
            "4W-Hybrid",
            "5W",
            "6i",
            "7i",
            "8i",
            "9i",
            "Putter",
          ].includes(club),
      ),
    },
    {
      phase: "putting",
      label: "Putting",
      clubs: clubs.filter((club) => club === "Putter"),
    },
  ];
  const toggle = (phase: ShotPhase, club: string) => {
    setActivePhase(phase);
    const existing = shots.find((shot) => shot.phase === phase);
    if (existing?.club === club)
      return setShots(shots.filter((shot) => shot.id !== existing.id));
    setShots([
      ...shots.filter((shot) => shot.phase !== phase),
      { id: crypto.randomUUID(), phase, club },
    ]);
  };
  const setOutcome = (
    phase: ShotPhase,
    outcome: "good" | "bad",
    note: string,
  ) => {
    setShots(
      shots.map((shot) =>
        shot.phase === phase
          ? {
              ...shot,
              outcome: shot.note === note ? undefined : outcome,
              note: shot.note === note ? undefined : note,
            }
          : shot,
      ),
    );
    setActivePhase(null);
  };
  return (
    <div className="shot-groups">
      <p className="shot-help">
        Add only the important clubs. Every section is optional.
      </p>
      {groups.map((group) => {
        const shot = shots.find((item) => item.phase === group.phase);
        return (
          <div className="shot-group" key={group.phase}>
            <button
              type="button"
              className={`shot-group-heading ${activePhase === group.phase ? "open" : ""}`}
              onClick={() =>
                setActivePhase(activePhase === group.phase ? null : group.phase)
              }
            >
              <strong>{group.label}</strong>
              {shot && <span>{shot.club}</span>}
              <small>
                {activePhase === group.phase ? "Close" : shot ? "Edit" : "Add"}
              </small>
            </button>
            {activePhase === group.phase && (
              <div className="shot-clubs">
                {group.clubs.map((club) => (
                  <button
                    type="button"
                    key={club}
                    className={shot?.club === club ? "selected" : ""}
                    onClick={() => toggle(group.phase, club)}
                  >
                    {club}
                  </button>
                ))}
              </div>
            )}
            {shot && activePhase === group.phase && (
              <div className="shot-outcomes">
                {outcomeOptions[group.phase].good.map((note) => (
                  <button
                    type="button"
                    key={note}
                    className={
                      shot.outcome === "good" && shot.note === note
                        ? "selected good"
                        : ""
                    }
                    onClick={() => setOutcome(group.phase, "good", note)}
                  >
                    ✓ {note}
                  </button>
                ))}
                {outcomeOptions[group.phase].bad.map((note) => (
                  <button
                    type="button"
                    key={note}
                    className={
                      shot.outcome === "bad" && shot.note === note
                        ? "selected bad"
                        : ""
                    }
                    onClick={() => setOutcome(group.phase, "bad", note)}
                  >
                    × {note}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;

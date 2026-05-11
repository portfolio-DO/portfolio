"use client";

import { useState, useRef } from "react";
import toast from "react-hot-toast";

type Panel = "dashboard" | "essay" | "math" | "synthesis" | "stats";
type Difficulty = "easy" | "medium" | "hard";

interface EssayCriterion { name: string; score: number; max: number; comment: string; }
interface EssayFeedback { type: "good" | "warn" | "bad"; text: string; }
interface EssayScore {
  totalScore: number; maxScore: number;
  criteria: EssayCriterion[]; feedback: EssayFeedback[]; summary: string;
  strongPoints: string[]; weakPoints: string[];
}
interface MathTask {
  id: number; type: "closed" | "open"; difficulty: Difficulty;
  points: number; content: string; contentLatex?: string; options?: string[];
  correctAnswer: string; solution: string; hasImage?: boolean; imageDescription?: string;
}
interface SourceText { num: number; type: string; title: string; author: string; text: string; }
interface SynthesisTask { topic: string; sources: SourceText[]; instruction: string; maxPoints: number; }
interface SynthesisCriterion { name: string; score: number; max: number; }
interface SynthesisScore { score: number; maxScore: number; criteria: SynthesisCriterion[]; summary: string; feedback: string; }
interface AnswerCheckResult { correct: boolean; explanation: string; partialCredit?: boolean; }

// ============================================================
// GEMINI PROXY
// ============================================================

async function callGemini(prompt: string, maxTokens = 6000, temperature = 0.7): Promise<string> {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens, temperature }),
  });
  const data = await res.json();
  if (!res.ok) {
    const hint = data.hint ? `\n\nWskazowka: ${data.hint}` : "";
    throw new Error((data.error || "Blad serwera") + hint);
  }
  return data.text as string;
}

function repairJSON(raw: string): string {
  let s = raw.trim();
  s = s.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  s = s.replace(/,\s*([}\]])/g, "$1");
  s = s.replace(/}\s*\{/g, "},{");
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ");
  return s;
}

async function callGeminiJSON<T>(prompt: string): Promise<T> {
  const fullPrompt = `Odpowiedz TYLKO i WYLACZNIE czystym JSON-em. Nic wiecej nie pisz. Bez markdown, bez backticks, bez wyjasnie, bez "Oto JSON".\n\n${prompt}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let text = "";
    try {
      text = await callGemini(fullPrompt, 8000, 0.05);
      let cleaned = text.trim();
      cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
      cleaned = repairJSON(cleaned);
      const parsed = JSON.parse(cleaned) as T;
      return parsed;
    } catch (e) {
      console.error(`[JSON] Proba ${attempt} nieudana:`, (e as Error).message, text.slice(0, 200));
      if (attempt === 3) throw new Error("AI zwrocilo niepoprawny JSON po 3 probach. Sprobuj ponownie.");
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  throw new Error("Blad JSON");
}

// ============================================================
// MATH RENDERING — zamienia sqrt/pi/^2 na ladne znaki
// ============================================================

function renderMath(text: string): string {
  if (!text) return text;
  let s = text;
  // sqrt(x) -> \u221ax
  s = s.replace(/sqrt\(([^)]+)\)/g, '\u221a($1)');
  s = s.replace(/\\sqrt\{([^}]+)\}/g, '\u221a($1)');
  s = s.replace(/sqrt(\d+)/g, '\u221a$1');
  // pi
  s = s.replace(/\\pi\b/g, '\u03c0');
  s = s.replace(/\bpi\b/g, '\u03c0');
  // potegi ^2 ^3 itp
  s = s.replace(/\^2/g, '\u00b2');
  s = s.replace(/\^3/g, '\u00b3');
  s = s.replace(/\^(\d)/g, (_, d) => {
    const sup: Record<string, string> = {'0':'\u2070','4':'\u2074','5':'\u2075','6':'\u2076','7':'\u2077','8':'\u2078','9':'\u2079'};
    return sup[d] || `^${d}`;
  });
  // ulamki \frac{a}{b} -> a/b
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  // cdot -> *
  s = s.replace(/\\cdot/g, '\u00b7');
  // infinity
  s = s.replace(/\\infty/g, '\u221e');
  // inne LaTeX
  s = s.replace(/\\_/g, '_');
  s = s.replace(/\\le\b/g, '\u2264');
  s = s.replace(/\\ge\b/g, '\u2265');
  s = s.replace(/\\neq\b/g, '\u2260');
  s = s.replace(/\\approx\b/g, '\u2248');
  s = s.replace(/\\in\b/g, '\u2208');
  s = s.replace(/\\[a-z]+/g, '');
  return s;
}

// ============================================================
// IKONY
// ============================================================

const IconHome = () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>;
const IconEssay = () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>;
const IconMath = () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>;
const IconSynth = () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>;
const IconStats = () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>;

// ============================================================
// UI COMPONENTS
// ============================================================

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "12px 0" }}>
      {[0,1,2].map(i => <div key={i} className="loading-dot" style={{ animationDelay: `${i*0.2}s` }}/>)}
    </div>
  );
}

function Btn({ children, onClick, variant="primary", size="md", disabled=false, style }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary"|"ghost";
  size?: "sm"|"md"; disabled?: boolean; style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    display:"inline-flex", alignItems:"center", gap:8,
    padding: size==="sm" ? "7px 14px" : "10px 20px",
    borderRadius:8, fontSize: size==="sm" ? 13 : 14, fontWeight:600,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    border:"none", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s", ...style,
  };
  if (variant==="primary") return <button style={{...base, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", color:"white", boxShadow:"0 0 20px rgba(59,130,246,0.3)"}} onClick={disabled?undefined:onClick} className="btn-glow">{children}</button>;
  return <button style={{...base, background:"#131929", border:"1px solid #1e2d4a", color:"#8899b5"}} onClick={disabled?undefined:onClick}>{children}</button>;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background:"#131929", border:"1px solid #1e2d4a", borderRadius:14, padding:24, ...style }}>{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="font-display" style={{ fontSize:14, fontWeight:700, color:"#e8edf5", marginBottom:16 }}>{children}</div>;
}

function ProgressBar({ value, max, color="linear-gradient(90deg,#3b82f6,#8b5cf6)" }: { value:number; max:number; color?:string }) {
  return <div className="progress-bar"><div className="progress-fill" style={{ width:`${Math.round((value/max)*100)}%`, background:color }}/></div>;
}

// Wizualizacja zadania matematycznego z opisem obrazka
function MathImagePlaceholder({ description }: { description: string }) {
  return (
    <div style={{ background:"rgba(59,130,246,0.06)", border:"1px dashed rgba(59,130,246,0.3)", borderRadius:10, padding:"20px 24px", marginBottom:16, display:"flex", alignItems:"center", gap:14 }}>
      <div style={{ fontSize:32 }}>&#128200;</div>
      <div>
        <div style={{ fontSize:12, color:"#3b82f6", fontWeight:600, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.5px" }}>Rysunek / wykres do zadania</div>
        <div style={{ fontSize:13, color:"#8899b5", lineHeight:1.6 }}>{description}</div>
      </div>
    </div>
  );
}

// ============================================================
// GLOWNY KOMPONENT
// ============================================================

export default function MaturAI() {
  const [panel, setPanel] = useState<Panel>("dashboard");
  const [isPremium, setIsPremium] = useState(false);
  const [apiOk, setApiOk] = useState<boolean|null>(null);

  // Essay
  const [essayTopic, setEssayTopic] = useState("Czy literatura piekna moze uczyc madrosci zyciowej? Rozwaz problem, odwolujac sie do wybranych utworow literackich.");
  const [essayText, setEssayText] = useState("");
  const [essayScore, setEssayScore] = useState<EssayScore|null>(null);
  const [essayLoading, setEssayLoading] = useState(false);
  const [topicLoading, setTopicLoading] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>();
  const [autoSaveMsg, setAutoSaveMsg] = useState("Zacznij pisac...");

  // Math
  const [mathTasks, setMathTasks] = useState<MathTask[]>([]);
  const [mathLoading, setMathLoading] = useState(false);
  const [mathLevel, setMathLevel] = useState("podstawowa");
  const [mathResults, setMathResults] = useState<Record<number, { correct: boolean; shown: boolean; explanation: string }>>({});
  const [mathAnswers, setMathAnswers] = useState<Record<number, string>>({});
  const [checkingAnswer, setCheckingAnswer] = useState<Record<number, boolean>>({});

  // Synthesis
  const [synthTask, setSynthTask] = useState<SynthesisTask|null>(null);
  const [synthText, setSynthText] = useState("");
  const [synthScore, setSynthScore] = useState<SynthesisScore|null>(null);
  const [synthLoading, setSynthLoading] = useState(false);
  const [synthAnalyzing, setSynthAnalyzing] = useState(false);

  // ============================================================
  // ERROR HANDLER
  // ============================================================

  const handleApiError = (e: unknown) => {
    const msg = (e as Error).message || "Nieznany blad";
    if (msg.includes("GEMINI_API_KEY") || msg.includes("env.local")) {
      toast.error("Brak klucza API. Sprawdz .env.local", { duration:6000 });
      setApiOk(false);
    } else if (msg.includes("403") || msg.includes("invalid")) {
      toast.error("Nieprawidlowy klucz API Gemini", { duration:6000 });
      setApiOk(false);
    } else {
      toast.error(msg.slice(0, 120));
    }
    console.error("[MaturAI]", msg);
  };

  const wordCount = essayText.trim().split(/\s+/).filter(w => w.length > 0).length;

  // ============================================================
  // ESSAY
  // ============================================================

  const onEssayInput = (val: string) => {
    setEssayText(val);
    setAutoSaveMsg("Zapisywanie...");
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => setAutoSaveMsg("Zapisano"), 1500);
  };

  const generateTopic = async () => {
    setTopicLoading(true);
    try {
      const r = await callGemini("Wygeneruj 1 realistyczny temat do rozprawki maturalnej z jezyka polskiego, poziom CKE. Sam temat bez cudzyslowow.", 200, 0.9);
      setEssayTopic(r.trim());
      setApiOk(true);
      toast.success("Nowy temat!");
    } catch (e) { handleApiError(e); }
    finally { setTopicLoading(false); }
  };

  const analyzeEssay = async () => {
    if (wordCount < 30) { toast.error("Napisz przynajmniej kilka zdan"); return; }
    setEssayLoading(true);
    setEssayScore(null);
    try {
      // Skrocony tekst zeby nie przekroczyc limitu tokenow
      const truncated = essayText.slice(0, 3000);
      const prompt = `Jestes doswiadczonym egzaminatorem maturalnym CKE z jezyka polskiego. Ocen ponizszą rozprawke zgodnie z oficjalnymi kryteriami CKE 2024.

TEMAT ROZPRAWKI: ${essayTopic}

TRESC ROZPRAWKI UCZNIA:
${truncated}

LICZBA SLOW: ${wordCount}

Ocen wedlug OFICJALNYCH kryteriow CKE dla rozprawki (35 punktow lacznie):
- Realizacja tematu wypowiedzi (0-9 pkt): czy uczen odpowiada na pytanie/realizuje polecenie, czy ma teze/hipoteze, czy argumentuje
- Kompetencje literackie i kulturowe (0-8 pkt): znajomosc lektur, trafnosc przykladow, konteksty kulturowe
- Kompozycja tekstu (0-6 pkt): spojnosc, logika, wstep/rozwinięcie/zakonczenie, akapity  
- Styl i jezyk (0-6 pkt): bogactwo slownictwa, styl odpowiedni do formy, precyzja
- Poprawnosc ortograficzna (0-3 pkt): bledy ortograficzne
- Poprawnosc interpunkcyjna (0-3 pkt): bledy interpunkcyjne

WAZNE zasady punktacji CKE:
- Jesli uczen nie napisal tezy/hipotezy -> max 0 pkt za realizacje tematu
- Jesli brak odwolan do lektur -> max 2 pkt za kompetencje literackie
- Jesli tekst ponizej 250 slow -> punkty za jezyk i styl obnizone
- Brak akapitow -> 0 pkt za kompozycje

Zwroc TYLKO JSON:
{"totalScore":0,"maxScore":35,"criteria":[{"name":"Realizacja tematu","score":0,"max":9,"comment":"szczegolowy komentarz co konkretnie oceniles"},{"name":"Kompetencje literackie i kulturowe","score":0,"max":8,"comment":"komentarz"},{"name":"Kompozycja tekstu","score":0,"max":6,"comment":"komentarz"},{"name":"Styl i jezyk","score":0,"max":6,"comment":"komentarz"},{"name":"Poprawnosc ortograficzna","score":0,"max":3,"comment":"komentarz"},{"name":"Poprawnosc interpunkcyjna","score":0,"max":3,"comment":"komentarz"}],"feedback":[{"type":"good","text":"konkretna mocna strona"},{"type":"good","text":"kolejna mocna strona"},{"type":"warn","text":"co wymaga poprawy"},{"type":"bad","text":"powazny blad lub brak"}],"strongPoints":["mocna strona 1","mocna strona 2","mocna strona 3"],"weakPoints":["slaba strona 1","slaba strona 2","slaba strona 3"],"summary":"Profesjonalne 2-3 zdaniowe podsumowanie oceny jak prawdziwy egzaminator"}`;

      const result = await callGeminiJSON<EssayScore>(prompt);
      // Zawsze przelicz sume z kryteriow
      result.totalScore = result.criteria.reduce((a,c) => a + Math.min(c.score, c.max), 0);
      result.maxScore = 35;
      if (!result.strongPoints) result.strongPoints = [];
      if (!result.weakPoints) result.weakPoints = [];
      setEssayScore(result);
      setApiOk(true);
      toast.success("Ocena gotowa!");
    } catch (e) { handleApiError(e); }
    finally { setEssayLoading(false); }
  };

  // ============================================================
  // MATH
  // ============================================================

  const generateMath = async () => {
    setMathLoading(true);
    setMathTasks([]);
    setMathResults({});
    setMathAnswers({});
    try {
      const isRoz = mathLevel === "rozszerzona";
      const prompt = `Wygeneruj 4 zadania maturalne z matematyki, poziom ${mathLevel}.

Zasady:
- Zadania maja byc realistyczne jak z arkuszy CKE
- NIE uzywaj LaTeX ani sqrt() - pisz wzory slownie lub uzywaj znakow: x^2 zamiast x squared, pierwiastek(x) zamiast sqrt(x)
- Dla zadan z figurami/wykresami opisz dokladnie rysunek w polu imageDescription
- Poprawna odpowiedz musi byc precyzyjna liczba lub wyrazenie
- Zadania: 1 zamkniete (4 opcje), 3 otwarte roznej trudnosci

Zwroc TYLKO JSON:
{"tasks":[
{"id":1,"type":"closed","difficulty":"easy","points":1,"content":"Tresc zadania zamknietego z konkretnymi liczbami","options":["A. pierwsza opcja","B. druga opcja","C. trzecia opcja","D. czwarta opcja"],"correctAnswer":"A","solution":"Krotkie wyjasnienie dlaczego A","hasImage":false},
{"id":2,"type":"open","difficulty":"easy","points":2,"content":"Tresc prostego zadania otwartego","correctAnswer":"konkretna liczba lub wyrazenie np. x=3","solution":"Rozwiazanie krok po kroku","hasImage":false},
{"id":3,"type":"open","difficulty":"medium","points":3,"content":"Tresc zadania sredniej trudnosci${isRoz ? " z trygonometria lub pochodna" : " z funkcja lub geometria"}","correctAnswer":"wynik","solution":"Szczegolowe rozwiazanie","hasImage":${isRoz ? "true" : "false"}${isRoz ? ',"imageDescription":"Opis wykresu lub rysunku potrzebnego do zadania"' : ""}},
{"id":4,"type":"open","difficulty":"hard","points":4,"content":"Trudniejsze zadanie${isRoz ? " z calkami lub kombinatoryka" : " z ukladem rownan lub geometria"}","correctAnswer":"wynik","solution":"Pelne szczegolowe rozwiazanie","hasImage":false}
]}`;

      const result = await callGeminiJSON<{ tasks: MathTask[] }>(prompt);
      // Zastosuj renderowanie matematyki do tresci i odpowiedzi
      result.tasks = result.tasks.map(t => ({
        ...t,
        content: renderMath(t.content),
        correctAnswer: renderMath(t.correctAnswer),
        solution: renderMath(t.solution),
        options: t.options?.map(o => renderMath(o)),
      }));
      setMathTasks(result.tasks);
      setApiOk(true);
      toast.success("Zadania wygenerowane!");
    } catch (e) { handleApiError(e); }
    finally { setMathLoading(false); }
  };

  // Sprawdzanie odpowiedzi przez AI — nie porownanie stringow!
  const checkAnswerAI = async (task: MathTask, idx: number) => {
    const userAnswer = (mathAnswers[idx] || "").trim();
    if (!userAnswer) { toast.error("Wpisz odpowiedz"); return; }

    setCheckingAnswer(p => ({ ...p, [idx]: true }));
    try {
      const prompt = `Jestes nauczycielem matematyki. Sprawdz czy odpowiedz ucznia jest poprawna matematycznie.

Zadanie: ${task.content}
Poprawna odpowiedz (wzorcowa): ${task.correctAnswer}
Odpowiedz ucznia: ${userAnswer}

Zasady oceniania:
- Odpowiedz jest poprawna jesli jest matematycznie rownowazna wzorcowej (np. "3/2" i "x=3/2" i "1,5" to to samo)
- Akceptuj rozne zapisy tej samej wartosci
- Jesli wynik jest czesciowo poprawny (np. dobra metoda, zly wynik) to partialCredit=true
- Odpowiedz po polsku, krotko i jasno

Zwroc TYLKO JSON:
{"correct":true,"explanation":"Krotkie wyjasnienie (1-2 zdania)","partialCredit":false}`;

      const result = await callGeminiJSON<AnswerCheckResult>(prompt);
      setMathResults(p => ({ ...p, [idx]: { correct: result.correct, shown: true, explanation: result.explanation } }));
      if (result.correct) toast.success(`Poprawnie! +${task.points} pkt`);
    } catch (e) {
      // Fallback: proste porownanie
      const ans = userAnswer.toLowerCase().replace(/\s/g, "").replace(/x=/g, "");
      const correct = task.correctAnswer.toLowerCase().replace(/\s/g, "").replace(/x=/g, "");
      const isCorrect = ans === correct || ans.includes(correct) || correct.includes(ans);
      setMathResults(p => ({ ...p, [idx]: { correct: isCorrect, shown: true, explanation: isCorrect ? "Poprawna odpowiedz!" : `Oczekiwano: ${task.correctAnswer}` } }));
      handleApiError(e);
    } finally {
      setCheckingAnswer(p => ({ ...p, [idx]: false }));
    }
  };

  const selectOption = (idx: number, selected: string, correct: string) => {
    const isCorrect = selected === correct;
    setMathResults(p => ({ ...p, [idx]: { correct: isCorrect, shown: true, explanation: isCorrect ? "Poprawna odpowiedz!" : `Prawidlowa odpowiedz to: ${correct}` } }));
  };

  // ============================================================
  // SYNTHESIS
  // ============================================================

  const generateSynth = async () => {
    setSynthLoading(true);
    setSynthTask(null);
    setSynthScore(null);
    setSynthText("");
    try {
      const prompt = `Wygeneruj realistyczne zadanie do notatki syntetyzujacej na mature z jezyka polskiego (CKE 2024).

Wymagania:
- 2 dluge teksty zrodlowe (kazdy ok. 250-300 slow) na ten sam temat
- Teksty maja sie wzajemnie uzupelniac i miejscami ze soba polemizowac
- Tematy: natura/ekologia, technologia/czlowiek, kultura/tozsamosc, wolnosc/odpowiedzialnosc itp.
- Teksty maja byc autentycznie brzmace (esej, artykul publicystyczny)
- Instrukcja ma byc dokladna jak na CKE

Zwroc TYLKO JSON:
{"topic":"Temat syntezy (krotki, konkretny)","sources":[{"num":1,"type":"esej","title":"Tytul eseju","author":"Imie Nazwisko (wymyslony autor)","text":"Dlugi autentyczny tekst eseju ok 280 slow. Powinien poruszac temat z konkretna perspektywa, zawierac argumenty, przyklady, refleksje. To ma byc prawdziwie brzmacy tekst humanistyczny."},{"num":2,"type":"artykul publicystyczny","title":"Tytul artykulu","author":"Imie Nazwisko (inny autor)","text":"Dlugi artykul publicystyczny ok 260 slow. Moze polemizowac z pierwszym tekstem lub uzupelniac go z innej perspektywy. Konkretne przyklady, dane, argumenty."}],"instruction":"Na podstawie obu tekstow napisz notate syntetyzujaca na temat: [temat]. Twoja notatka powinna: uwzglednic stanowiska obu autorow, wskazac punkty wspolne i roznice miedzy tekstami, przedstawic wlasna synteze zagadnienia. Objetosc: 150-200 slow.","maxPoints":15}`;

      const result = await callGeminiJSON<SynthesisTask>(prompt);
      setSynthTask(result);
      setApiOk(true);
      toast.success("Zadanie wygenerowane!");
    } catch (e) { handleApiError(e); }
    finally { setSynthLoading(false); }
  };

  const analyzeSynth = async () => {
    if (!synthTask || synthText.trim().length < 60) { toast.error("Napisz wiecej"); return; }
    setSynthAnalyzing(true);
    try {
      const prompt = `Jestes egzaminatorem CKE. Ocen notate syntetyzujaca ucznia.

TEMAT: ${synthTask.topic}

TEKST 1 (${synthTask.sources[0]?.title}):
${synthTask.sources[0]?.text?.slice(0, 500)}

TEKST 2 (${synthTask.sources[1]?.title}):
${synthTask.sources[1]?.text?.slice(0, 500)}

NOTATKA UCZNIA:
${synthText.slice(0, 2000)}

Ocen wedlug kryteriow CKE dla notatki syntetyzujacej (15 pkt):
- Uwzglednienie obu tekstow (0-5 pkt): czy uczen odwolal sie do obu autorow i ich argumentow
- Synteza a nie streszczenie (0-4 pkt): czy lacze informacje z obu tekstow zamiast je streszczac osobno
- Spojnosc i logika (0-3 pkt): czy notatka jest spojnie napisana i logicznie zbudowana
- Poprawnosc jezykowa (0-3 pkt): bledy jezykowe, ortograficzne, styl

Zwroc TYLKO JSON:
{"score":0,"maxScore":15,"criteria":[{"name":"Uwzglednienie obu tekstow","score":0,"max":5},{"name":"Synteza nie streszczenie","score":0,"max":4},{"name":"Spojnosc i logika","score":0,"max":3},{"name":"Poprawnosc jezykowa","score":0,"max":3}],"summary":"Ogolna ocena 2 zdania","feedback":"Szczegolowy komentarz co bylo dobre co zle i jak poprawic"}`;

      const result = await callGeminiJSON<SynthesisScore>(prompt);
      result.score = result.criteria.reduce((a,c) => a + Math.min(c.score, c.max), 0);
      setSynthScore(result);
      setApiOk(true);
      toast.success("Ocena gotowa!");
    } catch (e) { handleApiError(e); }
    finally { setSynthAnalyzing(false); }
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const pct = essayScore ? Math.round((essayScore.totalScore / essayScore.maxScore) * 100) : 0;
  const scoreColor = pct >= 70 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  const scoreLabel = pct >= 70 ? "Bardzo dobry wynik!" : pct >= 50 ? "Dobry wynik" : pct >= 40 ? "Wynik przecietny" : "Wymaga poprawy";

  const navItems = [
    { id:"dashboard" as Panel, label:"Pulpit", icon:<IconHome/> },
    { id:"essay" as Panel, label:"Rozprawka", icon:<IconEssay/>, badge:"AI" },
    { id:"math" as Panel, label:"Matematyka", icon:<IconMath/>, badge:"AI" },
    { id:"synthesis" as Panel, label:"Notatka syntetyzujaca", icon:<IconSynth/> },
    { id:"stats" as Panel, label:"Statystyki", icon:<IconStats/> },
  ];
  const titles: Record<Panel,string> = { dashboard:"Pulpit", essay:"Rozprawka", math:"Matematyka", synthesis:"Notatka syntetyzujaca", stats:"Statystyki" };
  const diffLabel: Record<string,string> = { easy:"Latwe", medium:"Srednie", hard:"Trudne" };
  const diffColor: Record<string,{bg:string;c:string}> = {
    easy:{bg:"rgba(16,185,129,0.12)",c:"#10b981"},
    medium:{bg:"rgba(245,158,11,0.12)",c:"#f59e0b"},
    hard:{bg:"rgba(239,68,68,0.12)",c:"#ef4444"},
  };

  // ============================================================
  // JSX
  // ============================================================

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#060812" }}>

      {/* SIDEBAR */}
      <aside style={{ width:260, background:"#0c1020", borderRight:"1px solid #1e2d4a", display:"flex", flexDirection:"column", position:"fixed", top:0, left:0, height:"100vh", zIndex:100 }}>
        <div style={{ padding:"24px 20px 20px", borderBottom:"1px solid #1e2d4a", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, boxShadow:"0 0 20px rgba(59,130,246,0.4)" }}>&#10022;</div>
          <div>
            <div className="font-display gradient-text" style={{ fontSize:18, fontWeight:800 }}>MaturAI</div>
            <div style={{ fontSize:11, color:"#4a5f7a", textTransform:"uppercase", letterSpacing:"0.5px" }}>Platforma maturalna</div>
          </div>
        </div>
        <nav style={{ padding:"16px 12px", flex:1, overflowY:"auto" }}>
          <div style={{ fontSize:10, color:"#4a5f7a", textTransform:"uppercase", letterSpacing:1, fontWeight:600, padding:"0 8px", marginBottom:8 }}>Nawigacja</div>
          {navItems.map(item => (
            <div key={item.id} onClick={() => setPanel(item.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, cursor:"pointer", color:panel===item.id?"#3b82f6":"#8899b5", fontSize:14, marginBottom:2, background:panel===item.id?"rgba(59,130,246,0.12)":"transparent", border:panel===item.id?"1px solid rgba(59,130,246,0.2)":"1px solid transparent", position:"relative" }}>
              {panel===item.id && <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:3, height:"60%", background:"#3b82f6", borderRadius:"0 2px 2px 0" }}/>}
              {item.icon}
              <span style={{ flex:1 }}>{item.label}</span>
              {item.badge && <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:600, background:"rgba(59,130,246,0.15)", color:"#3b82f6" }}>{item.badge}</span>}
            </div>
          ))}
        </nav>
        <div style={{ padding:16, borderTop:"1px solid #1e2d4a" }}>
          <div onClick={() => { setIsPremium(!isPremium); toast.success(isPremium?"Premium wylaczony":"Premium aktywowany!"); }} style={{ background:"linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.1))", border:"1px solid rgba(139,92,246,0.25)", borderRadius:10, padding:14, cursor:"pointer" }}>
            <div className="font-display" style={{ fontSize:13, fontWeight:700, color:"#e8edf5", marginBottom:4 }}>&#10022; Tryb Premium</div>
            <div style={{ fontSize:11, color:"#8899b5", lineHeight:1.5, marginBottom:10 }}>Szczegolowe ocenianie, pelne rozwiazania, analiza bledow</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div className={`toggle-switch ${isPremium?"on":""}`}/>
              <span style={{ fontSize:12, color:"#8899b5" }}>{isPremium?"Premium aktywny":"Tryb testowy - wlacz"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ marginLeft:260, flex:1, display:"flex", flexDirection:"column" }}>
        <div style={{ background:"rgba(6,8,18,0.8)", backdropFilter:"blur(20px)", borderBottom:"1px solid #1e2d4a", padding:"0 32px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
          <div className="font-display" style={{ fontSize:20, fontWeight:700, color:"#e8edf5" }}>{titles[panel]}</div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, padding:"6px 12px", borderRadius:20, border:"1px solid #1e2d4a", background:"#131929", color:"#8899b5" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:apiOk===true?"#10b981":apiOk===false?"#ef4444":"#f59e0b", boxShadow:`0 0 6px ${apiOk===true?"#10b981":apiOk===false?"#ef4444":"#f59e0b"}` }}/>
              {apiOk===true?"Gemini aktywne":apiOk===false?"Blad API":"Gemini API"}
            </div>
            {isPremium && <div style={{ background:"linear-gradient(90deg,#3b82f6,#8b5cf6)", color:"white", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:20 }}>&#10022; PREMIUM</div>}
          </div>
        </div>

        {apiOk===false && (
          <div style={{ background:"rgba(239,68,68,0.08)", borderBottom:"1px solid rgba(239,68,68,0.2)", padding:"14px 32px" }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#ef4444", marginBottom:6 }}>Blad konfiguracji API Gemini</div>
            <div style={{ fontSize:13, color:"#8899b5", lineHeight:1.7 }}>
              Stworz plik <code style={{ background:"#111827", padding:"2px 6px", borderRadius:4, color:"#3b82f6" }}>.env.local</code> i dodaj: <code style={{ background:"#111827", padding:"2px 6px", borderRadius:4, color:"#10b981" }}>GEMINI_API_KEY=twoj_klucz</code>, nastepnie zrestartuj serwer.
            </div>
          </div>
        )}

        <div style={{ flex:1, padding:32, maxWidth:1200, width:"100%", margin:"0 auto" }}>

          {/* ==================== DASHBOARD ==================== */}
          {panel==="dashboard" && (
            <div className="animate-fade-in">
              <div style={{ marginBottom:32 }}>
                <h1 className="font-display" style={{ fontSize:32, fontWeight:800, color:"#e8edf5", marginBottom:6 }}>
                  Witaj, <span className="gradient-text">Maturzysto</span>
                </h1>
                <p style={{ color:"#8899b5", fontSize:15 }}>Zostalo Ci <strong style={{ color:"#e8edf5" }}>47 dni</strong> do matury. Czas dzialac!</p>
              </div>

              {apiOk!==true && (
                <Card style={{ marginBottom:24, border:"1px solid rgba(59,130,246,0.3)", background:"rgba(59,130,246,0.05)" }}>
                  <div className="font-display" style={{ fontSize:15, fontWeight:700, color:"#3b82f6", marginBottom:12 }}>Konfiguracja API — wymagana do dzialania AI</div>
                  {[
                    {n:"1", t:"Wejdz na aistudio.google.com/app/apikey i zaloguj sie kontem Google"},
                    {n:"2", t:"Kliknij Create API key — klucz jest darmowy"},
                    {n:"3", t:"Stworz plik .env.local w folderze projektu (tam gdzie package.json)"},
                    {n:"4", t:"Wklej: GEMINI_API_KEY=AIzaSy... (twoj klucz)"},
                    {n:"5", t:"Zrestartuj serwer: Ctrl+C, potem npm run dev"},
                  ].map(s => (
                    <div key={s.n} style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:13, color:"#8899b5", marginBottom:8 }}>
                      <span style={{ minWidth:22, height:22, borderRadius:"50%", background:"rgba(59,130,246,0.15)", color:"#3b82f6", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{s.n}</span>
                      <span>{s.t}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:12, padding:"10px 14px", background:"#111827", borderRadius:8, fontFamily:"monospace", fontSize:13, color:"#10b981" }}>GEMINI_API_KEY=AIzaSyTwojKluczTutaj</div>
                </Card>
              )}

              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
                {[
                  {label:"Streak nauki", value:"7 dni", color:"#f59e0b", change:"Najdluzszy rekord!"},
                  {label:"Napisane rozprawki", value:"12", color:"#e8edf5", change:"+3 ten tydzien"},
                  {label:"Zadania matematyczne", value:"84", color:"#e8edf5", change:"76% poprawnych"},
                  {label:"Sr. wynik CKE", value:"68%", color:"#10b981", change:"+5pp ten miesiac"},
                ].map(s => (
                  <Card key={s.label}>
                    <div style={{ fontSize:12, color:"#4a5f7a", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>{s.label}</div>
                    <div className="font-display" style={{ fontSize:28, fontWeight:800, color:s.color, marginBottom:4 }}>{s.value}</div>
                    <div style={{ fontSize:12, color:"#10b981" }}>{s.change}</div>
                  </Card>
                ))}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20, marginBottom:28 }}>
                {[
                  {id:"essay" as Panel, icon:"&#9998;", title:"Rozprawka", desc:"AI oceni Twoja rozprawke jak prawdziwy egzaminator CKE — 35 punktow, 6 kryteriow, szczegolowy feedback", cta:"Zacznij pisac", pct:65, grad:"linear-gradient(90deg,#3b82f6,#8b5cf6)"},
                  {id:"math" as Panel, icon:"&#9663;", title:"Matematyka", desc:"Realistyczne zadania maturalne z AI — odpowiedzi sprawdzane matematycznie, nie tekstowo", cta:"Rozwiazuj zadania", pct:45, grad:"linear-gradient(90deg,#06b6d4,#3b82f6)"},
                  {id:"synthesis" as Panel, icon:"&#9776;", title:"Notatka syntetyzujaca", desc:"Dwa dluge teksty zrodlowe, cwicz synteze jak na prawdziwym egzaminie CKE", cta:"Cwicz synteze", pct:30, grad:"linear-gradient(90deg,#10b981,#06b6d4)"},
                ].map(m => (
                  <Card key={m.id} style={{ cursor:"pointer", transition:"all 0.3s", position:"relative", overflow:"hidden", paddingTop:28 }} onClick={() => setPanel(m.id)}>
                    <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:m.grad }}/>
                    <div style={{ fontSize:26, marginBottom:14 }} dangerouslySetInnerHTML={{ __html:m.icon }}/>
                    <div className="font-display" style={{ fontSize:17, fontWeight:700, color:"#e8edf5", marginBottom:6 }}>{m.title}</div>
                    <div style={{ fontSize:13, color:"#8899b5", lineHeight:1.6, marginBottom:16 }}>{m.desc}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#3b82f6" }}>{m.cta} &rarr;</div>
                    <div className="progress-bar" style={{ marginTop:14 }}>
                      <div className="progress-fill" style={{ width:`${m.pct}%`, background:m.grad }}/>
                    </div>
                  </Card>
                ))}
              </div>

              <Card>
                <SectionTitle>Ostatnia aktywnosc</SectionTitle>
                {[
                  {dot:"#3b82f6", text:"Rozprawka: Czy samotnosc jest wartoscia?", score:"24/35 pkt", sc:"#10b981", time:"2 godz. temu"},
                  {dot:"#06b6d4", text:"Matematyka - Funkcje kwadratowe", score:"4/5", sc:"#f59e0b", time:"wczoraj"},
                  {dot:"#10b981", text:"Notatka syntetyzujaca - ekologia", score:"11/15 pkt", sc:"#10b981", time:"2 dni temu"},
                ].map((a,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:i<2?"1px solid #1e2d4a":"none" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:a.dot }}/>
                    <div style={{ fontSize:14, color:"#e8edf5", flex:1 }}>{a.text}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:a.sc }}>{a.score}</div>
                    <div style={{ fontSize:12, color:"#4a5f7a" }}>{a.time}</div>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* ==================== ESSAY ==================== */}
          {panel==="essay" && (
            <div className="animate-fade-in">
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <h2 className="font-display" style={{ fontSize:22, fontWeight:800, color:"#e8edf5", marginBottom:4 }}>Rozprawka — ocena CKE 2024</h2>
                  <p style={{ fontSize:14, color:"#8899b5" }}>Napisz rozprawke, AI ja oceni wedlug oficjalnych kryteriow CKE (35 pkt)</p>
                </div>
                <Btn variant="ghost" size="sm" onClick={generateTopic} disabled={topicLoading}>{topicLoading?"Generowanie...":"Losuj temat"}</Btn>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 400px", gap:24 }}>
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  <Card style={{ borderColor:"rgba(59,130,246,0.3)" }}>
                    <div style={{ fontSize:11, color:"#3b82f6", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:8 }}>Temat rozprawki</div>
                    <div style={{ fontSize:15, color:"#e8edf5", lineHeight:1.7, fontWeight:500 }}>{essayTopic}</div>
                  </Card>

                  {/* Skala punktacji CKE */}
                  <Card style={{ padding:"14px 20px" }}>
                    <div style={{ fontSize:12, color:"#4a5f7a", fontWeight:600, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px" }}>Schemat punktacji CKE — rozprawka</div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {[
                        {name:"Realizacja tematu", max:9, color:"#3b82f6"},
                        {name:"Kompetencje lit.", max:8, color:"#8b5cf6"},
                        {name:"Kompozycja", max:6, color:"#06b6d4"},
                        {name:"Styl i jezyk", max:6, color:"#10b981"},
                        {name:"Ortografia", max:3, color:"#f59e0b"},
                        {name:"Interpunkcja", max:3, color:"#ef4444"},
                      ].map(c => (
                        <div key={c.name} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#8899b5", background:"#0c1020", padding:"4px 8px", borderRadius:6, border:"1px solid #1e2d4a" }}>
                          <span style={{ width:8, height:8, borderRadius:"50%", background:c.color, display:"inline-block" }}/>
                          {c.name} ({c.max} pkt)
                        </div>
                      ))}
                    </div>
                  </Card>

                  <div style={{ background:"#131929", border:"1px solid #1e2d4a", borderRadius:14, display:"flex", flexDirection:"column", minHeight:400 }}>
                    <div style={{ padding:"12px 16px", borderBottom:"1px solid #1e2d4a", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontSize:13, color:"#8899b5" }}>
                        Slowa: <strong style={{ color:wordCount>=250?"#10b981":wordCount>=150?"#f59e0b":"#e8edf5" }}>{wordCount}</strong>
                        <span style={{ color:"#4a5f7a" }}> / min. 250</span>
                        {wordCount>0 && wordCount<250 && <span style={{ color:"#f59e0b", fontSize:11, marginLeft:8 }}>— za malo!</span>}
                        {wordCount>=250 && <span style={{ color:"#10b981", fontSize:11, marginLeft:8 }}>— wymagane minimum</span>}
                      </div>
                      <div style={{ fontSize:12, color:autoSaveMsg==="Zapisano"?"#10b981":"#4a5f7a" }}>{autoSaveMsg}</div>
                    </div>
                    <textarea className="editor" style={{ flex:1, padding:24, minHeight:360 }} value={essayText} onChange={e => onEssayInput(e.target.value)} placeholder="Zacznij pisac swoja rozprawke...&#10;&#10;Pamietaj o:&#10;- Jasnej tezie lub hipotezie na poczatku&#10;- Przynajmniej 2 argumentach z odwolaniem do lektur&#10;- Kontekstach kulturowych, filozoficznych lub historycznych&#10;- Spojnym zakonczeniu"/>
                    <div style={{ padding:"12px 16px", borderTop:"1px solid #1e2d4a", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontSize:12, color:"#4a5f7a" }}>Min. 250 slow | Maks. ~500 slow</div>
                      <Btn onClick={analyzeEssay} disabled={essayLoading}>{essayLoading?"Analizowanie...":"Ocen rozprawke (AI)"}</Btn>
                    </div>
                  </div>
                </div>

                {/* Panel oceny */}
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  <Card>
                    <SectionTitle>Ocena CKE</SectionTitle>
                    {essayLoading && <div style={{ textAlign:"center" }}><LoadingDots/><div style={{ fontSize:13, color:"#8899b5" }}>AI ocenia jak egzaminator CKE...</div></div>}
                    {!essayLoading && !essayScore && <div style={{ fontSize:13, color:"#4a5f7a", padding:"16px 0", textAlign:"center" }}>Napisz rozprawke i kliknij "Ocen"</div>}
                    {essayScore && (
                      <div style={{ textAlign:"center", paddingBottom:16 }}>
                        <div className="font-display" style={{ fontSize:56, fontWeight:800, color:scoreColor, lineHeight:1 }}>{essayScore.totalScore}</div>
                        <div style={{ fontSize:22, color:"#8899b5", marginBottom:6 }}>/ 35 pkt</div>
                        <div style={{ display:"inline-block", padding:"4px 12px", borderRadius:20, background:`${scoreColor}22`, border:`1px solid ${scoreColor}44`, fontSize:13, fontWeight:600, color:scoreColor, marginBottom:10 }}>{pct}% — {scoreLabel}</div>
                        <div style={{ fontSize:13, color:"#8899b5", lineHeight:1.6 }}>{essayScore.summary}</div>
                      </div>
                    )}
                  </Card>

                  {essayScore && (
                    <Card>
                      <SectionTitle>Kryteria CKE — szczegolowo</SectionTitle>
                      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                        {essayScore.criteria.map(c => (
                          <div key={c.name}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                              <span style={{ fontSize:13, color:"#e8edf5", fontWeight:500 }}>{c.name}</span>
                              <span style={{ fontSize:13, fontWeight:700, color:c.score/c.max>=0.7?"#10b981":c.score/c.max>=0.5?"#f59e0b":"#ef4444" }}>{c.score}/{c.max}</span>
                            </div>
                            <ProgressBar value={c.score} max={c.max}/>
                            {c.comment && <div style={{ fontSize:12, color:"#4a5f7a", marginTop:4, lineHeight:1.5 }}>{c.comment}</div>}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {essayScore && (essayScore.strongPoints?.length>0 || essayScore.weakPoints?.length>0) && (
                    <Card>
                      <SectionTitle>Mocne i slabe strony</SectionTitle>
                      {essayScore.strongPoints?.length>0 && (
                        <div style={{ marginBottom:14 }}>
                          <div style={{ fontSize:12, color:"#10b981", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Mocne strony</div>
                          {essayScore.strongPoints.map((p,i) => (
                            <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:6, fontSize:13, color:"#8899b5" }}>
                              <span style={{ color:"#10b981", flexShrink:0, marginTop:1 }}>&#10003;</span>
                              <span>{p}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {essayScore.weakPoints?.length>0 && (
                        <div>
                          <div style={{ fontSize:12, color:"#ef4444", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Do poprawy</div>
                          {essayScore.weakPoints.map((p,i) => (
                            <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:6, fontSize:13, color:"#8899b5" }}>
                              <span style={{ color:"#ef4444", flexShrink:0, marginTop:1 }}>&#10005;</span>
                              <span>{p}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )}

                  {essayScore && essayScore.feedback?.length>0 && (
                    <Card>
                      <SectionTitle>Komentarz egzaminatora</SectionTitle>
                      {essayScore.feedback.map((f,i) => {
                        const s = {good:{bg:"rgba(16,185,129,0.12)",c:"#10b981",l:"Dobrze"},warn:{bg:"rgba(245,158,11,0.12)",c:"#f59e0b",l:"Popraw"},bad:{bg:"rgba(239,68,68,0.12)",c:"#ef4444",l:"Uwaga"}}[f.type]||{bg:"rgba(245,158,11,0.12)",c:"#f59e0b",l:"Info"};
                        return (
                          <div key={i} style={{ display:"flex", gap:10, padding:"10px 0", borderBottom:i<essayScore.feedback.length-1?"1px solid #1e2d4a":"none" }}>
                            <span style={{ fontSize:11, fontWeight:600, padding:"2px 7px", borderRadius:4, background:s.bg, color:s.c, flexShrink:0, alignSelf:"flex-start", marginTop:1 }}>{s.l}</span>
                            <span style={{ fontSize:13, color:"#8899b5", lineHeight:1.5 }}>{f.text}</span>
                          </div>
                        );
                      })}
                    </Card>
                  )}

                  <div style={{ position:"relative", overflow:"hidden" }}>
                    <Card>
                      <div style={{ filter:isPremium?"none":"blur(4px)", pointerEvents:isPremium?"auto":"none" }}>
                        <SectionTitle>Analiza zdanie po zdaniu</SectionTitle>
                        <div style={{ fontSize:13, color:"#8899b5", lineHeight:1.6 }}>Szczegolowa analiza kazdego argumentu, sugestie ulepszen i propozycje lepszych sformulowan.</div>
                      </div>
                    </Card>
                    {!isPremium && (
                      <div onClick={() => { setIsPremium(true); toast.success("Premium aktywowany!"); }} style={{ position:"absolute", inset:0, background:"rgba(6,8,18,0.85)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:14, cursor:"pointer" }}>
                        <span style={{ fontSize:13, fontWeight:600, color:"#8899b5" }}>Tylko Premium — kliknij by wlaczyc</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== MATH ==================== */}
          {panel==="math" && (
            <div className="animate-fade-in">
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <h2 className="font-display" style={{ fontSize:22, fontWeight:800, color:"#e8edf5", marginBottom:4 }}>Matematyka maturalna</h2>
                  <p style={{ fontSize:14, color:"#8899b5" }}>Zadania generowane przez AI — odpowiedzi sprawdzane matematycznie</p>
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <select value={mathLevel} onChange={e => setMathLevel(e.target.value)} style={{ background:"#131929", border:"1px solid #1e2d4a", borderRadius:8, padding:"8px 12px", color:"#e8edf5", fontSize:13, outline:"none" }}>
                    <option value="podstawowa">Podstawowa</option>
                    <option value="rozszerzona">Rozszerzona</option>
                  </select>
                  <Btn onClick={generateMath} disabled={mathLoading}>{mathLoading?"Generowanie...":"Generuj zadania"}</Btn>
                </div>
              </div>

              {mathLoading && <Card style={{ textAlign:"center", padding:48 }}><LoadingDots/><div style={{ fontSize:14, color:"#8899b5", marginTop:8 }}>Generowanie zadan maturalnych...</div></Card>}

              {!mathLoading && mathTasks.length===0 && (
                <Card style={{ textAlign:"center", padding:60 }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>&#8722;</div>
                  <div style={{ fontSize:15, color:"#4a5f7a", marginBottom:24 }}>Kliknij "Generuj zadania" by otrzymac zestaw zadan maturalnych</div>
                  <Btn onClick={generateMath}>Generuj zadania</Btn>
                </Card>
              )}

              <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
                {mathTasks.map((task, idx) => {
                  const dc = diffColor[task.difficulty]||diffColor.medium;
                  const result = mathResults[idx];
                  const isChecking = checkingAnswer[idx];
                  return (
                    <Card key={task.id}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          <span className="font-display" style={{ fontSize:13, fontWeight:700, color:"#3b82f6" }}>Zadanie {task.id}</span>
                          <span style={{ fontSize:11, padding:"3px 8px", borderRadius:20, fontWeight:600, background:dc.bg, color:dc.c }}>{diffLabel[task.difficulty]||task.difficulty}</span>
                          {task.hasImage && <span style={{ fontSize:11, padding:"3px 8px", borderRadius:20, fontWeight:600, background:"rgba(139,92,246,0.12)", color:"#8b5cf6" }}>z rysunkiem</span>}
                        </div>
                        <span style={{ fontSize:12, color:"#4a5f7a" }}>{task.points} pkt</span>
                      </div>

                      {/* Obrazek/rysunek jesli jest */}
                      {task.hasImage && task.imageDescription && <MathImagePlaceholder description={task.imageDescription}/>}

                      <div style={{ fontSize:15, color:"#e8edf5", lineHeight:1.8, marginBottom:18, fontFamily:"'DM Sans',sans-serif" }}>{task.content}</div>

                      {task.type==="closed" && task.options ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                          {task.options.map((opt,oi) => (
                            <div key={oi} onClick={() => !result?.shown && selectOption(idx, opt[0], task.correctAnswer)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", border:`1px solid ${result?.shown && opt[0]===task.correctAnswer?"rgba(16,185,129,0.4)":"#1e2d4a"}`, borderRadius:8, cursor:result?.shown?"default":"pointer", fontSize:14, color:result?.shown && opt[0]===task.correctAnswer?"#10b981":"#8899b5", background:result?.shown && opt[0]===task.correctAnswer?"rgba(16,185,129,0.08)":"transparent", transition:"all 0.2s" }}>
                              <span style={{ width:18, height:18, borderRadius:"50%", border:`1.5px solid ${result?.shown && opt[0]===task.correctAnswer?"#10b981":"#2a3d5c"}`, display:"inline-block", flexShrink:0 }}/>
                              {opt}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                          <input className="field" value={mathAnswers[idx]||""} onChange={e => setMathAnswers(p => ({...p,[idx]:e.target.value}))} onKeyDown={e => e.key==="Enter" && !result?.shown && !isChecking && checkAnswerAI(task, idx)} placeholder="Twoja odpowiedz (np. x=3, 1/2, pierwiastek(5))..." disabled={result?.shown||isChecking} style={{ fontFamily:"'DM Sans',sans-serif" }}/>
                          <Btn variant="ghost" size="sm" onClick={() => checkAnswerAI(task, idx)} disabled={result?.shown||isChecking}>{isChecking?"Sprawdzam...":"Sprawdz"}</Btn>
                        </div>
                      )}

                      {isChecking && (
                        <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#8899b5" }}>
                          <div className="loading-dot"/> <div className="loading-dot" style={{ animationDelay:"0.2s" }}/> <div className="loading-dot" style={{ animationDelay:"0.4s" }}/>
                          <span>AI sprawdza odpowiedz matematycznie...</span>
                        </div>
                      )}

                      {result?.shown && (
                        <div style={{ marginTop:14, padding:"14px 16px", borderRadius:8, fontSize:13, background:result.correct?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)", border:`1px solid ${result.correct?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.25)"}`, color:result.correct?"#10b981":"#ef4444" }}>
                          <div style={{ fontWeight:600, marginBottom:4 }}>{result.correct?`Poprawna odpowiedz! +${task.points} pkt`:"Niepoprawna odpowiedz"}</div>
                          <div style={{ color:"#8899b5", fontSize:12 }}>{result.explanation}</div>
                          {!result.correct && isPremium && (
                            <div style={{ marginTop:10, padding:"10px 12px", borderRadius:6, background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.2)", color:"#8899b5" }}>
                              <strong style={{ color:"#3b82f6" }}>Rozwiazanie krok po kroku:</strong><br/>
                              <span style={{ fontSize:12, lineHeight:1.7 }}>{task.solution}</span>
                            </div>
                          )}
                          {!result.correct && !isPremium && (
                            <div onClick={() => { setIsPremium(true); toast.success("Premium aktywowany!"); }} style={{ marginTop:10, padding:"8px 12px", borderRadius:6, background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.15)", color:"#3b82f6", fontSize:12, cursor:"pointer" }}>
                              &#10022; Premium: pełne rozwiazanie krok po kroku — kliknij by aktywowac
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== SYNTHESIS ==================== */}
          {panel==="synthesis" && (
            <div className="animate-fade-in">
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <h2 className="font-display" style={{ fontSize:22, fontWeight:800, color:"#e8edf5", marginBottom:4 }}>Notatka syntetyzujaca</h2>
                  <p style={{ fontSize:14, color:"#8899b5" }}>Dwa dluge teksty zrodlowe — cwicz synteze jak na egzaminie CKE (15 pkt)</p>
                </div>
                <Btn variant="ghost" size="sm" onClick={generateSynth} disabled={synthLoading}>{synthLoading?"Generowanie...":"Nowe teksty"}</Btn>
              </div>

              {synthLoading && <Card style={{ textAlign:"center", padding:48 }}><LoadingDots/><div style={{ fontSize:14, color:"#8899b5", marginTop:8 }}>Generowanie dlugich tekstow zrodlowych...</div></Card>}

              {!synthLoading && !synthTask && (
                <Card style={{ textAlign:"center", padding:60 }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>&#128196;</div>
                  <div style={{ fontSize:15, color:"#4a5f7a", marginBottom:24 }}>Kliknij "Nowe teksty" by wygenerowac zadanie do syntezy z 2 dlugimi tekstami</div>
                  <Btn onClick={generateSynth}>Generuj zadanie</Btn>
                </Card>
              )}

              {synthTask && !synthLoading && (
                <>
                  <Card style={{ marginBottom:20, borderColor:"rgba(59,130,246,0.3)" }}>
                    <div style={{ fontSize:11, color:"#3b82f6", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:8 }}>Temat syntezy</div>
                    <div style={{ fontSize:17, color:"#e8edf5", fontWeight:700, marginBottom:8 }}>{synthTask.topic}</div>
                    <div style={{ fontSize:13, color:"#8899b5", lineHeight:1.6, padding:"12px 14px", background:"rgba(59,130,246,0.05)", borderRadius:8, border:"1px solid rgba(59,130,246,0.15)" }}>{synthTask.instruction}</div>
                  </Card>

                  {/* 2 teksty obok siebie */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
                    {synthTask.sources.map(s => (
                      <Card key={s.num} style={{ display:"flex", flexDirection:"column" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                          <div>
                            <div style={{ fontSize:11, fontWeight:700, color:"#3b82f6", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Tekst {s.num} — {s.type}</div>
                            <div className="font-display" style={{ fontSize:15, fontWeight:700, color:"#e8edf5", marginBottom:2 }}>{s.title}</div>
                            <div style={{ fontSize:12, color:"#4a5f7a" }}>{s.author}</div>
                          </div>
                          <span style={{ fontSize:11, padding:"3px 8px", borderRadius:20, background:"rgba(59,130,246,0.1)", color:"#3b82f6", fontWeight:600, flexShrink:0 }}>Tekst {s.num}</span>
                        </div>
                        <div style={{ fontSize:13, color:"#8899b5", lineHeight:1.8, overflowY:"auto", maxHeight:320, paddingRight:4, flex:1, whiteSpace:"pre-wrap" }}>{s.text}</div>
                        <div style={{ marginTop:10, fontSize:11, color:"#4a5f7a" }}>ok. {s.text.split(" ").length} slow</div>
                      </Card>
                    ))}
                  </div>

                  <div style={{ background:"#131929", border:"1px solid #1e2d4a", borderRadius:14, overflow:"hidden", marginBottom:20 }}>
                    <div style={{ padding:16, borderBottom:"1px solid #1e2d4a", display:"flex", justifyContent:"space-between" }}>
                      <div style={{ fontSize:14, fontWeight:600, color:"#e8edf5" }}>Twoja notatka syntetyzujaca</div>
                      <div style={{ fontSize:12, color:"#4a5f7a" }}>150-200 slow | Max. {synthTask.maxPoints} pkt</div>
                    </div>
                    <textarea className="editor" style={{ minHeight:220, padding:20 }} value={synthText} onChange={e => setSynthText(e.target.value)} placeholder="Napisz tutaj swoja notate syntetyzujaca...&#10;&#10;Pamietaj: &#10;- Odwolaj sie do obu tekstow (podaj nazwiska autorow)&#10;- Szukaj punktow wspolnych i roznic&#10;- Syntezuj — nie streszczaj osobno kazdego tekstu"/>
                    <div style={{ padding:"12px 16px", borderTop:"1px solid #1e2d4a", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontSize:12, color:"#4a5f7a" }}>Slow: {synthText.trim().split(/\s+/).filter(w=>w.length>0).length} / 150-200</div>
                      <Btn onClick={analyzeSynth} disabled={synthAnalyzing}>{synthAnalyzing?"Analizowanie...":"Ocen notate (AI)"}</Btn>
                    </div>
                  </div>

                  {synthAnalyzing && <Card style={{ textAlign:"center" }}><LoadingDots/><div style={{ fontSize:14, color:"#8899b5" }}>AI ocenia Twoja notate wedlug kryteriow CKE...</div></Card>}

                  {synthScore && (
                    <Card>
                      <div style={{ textAlign:"center", marginBottom:24 }}>
                        <div className="font-display gradient-text" style={{ fontSize:48, fontWeight:800 }}>{synthScore.score}</div>
                        <div style={{ color:"#8899b5", fontSize:18 }}>/ {synthScore.maxScore} pkt</div>
                        <div style={{ fontSize:13, color:"#8899b5", marginTop:8 }}>{synthScore.summary}</div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
                        {synthScore.criteria.map(c => (
                          <div key={c.name}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                              <span style={{ fontSize:13, color:"#8899b5" }}>{c.name}</span>
                              <span style={{ fontSize:13, fontWeight:600, color:c.score/c.max>=0.7?"#10b981":c.score/c.max>=0.5?"#f59e0b":"#ef4444" }}>{c.score}/{c.max}</span>
                            </div>
                            <ProgressBar value={c.score} max={c.max} color="linear-gradient(90deg,#10b981,#06b6d4)"/>
                          </div>
                        ))}
                      </div>
                      {synthScore.feedback && (
                        <div style={{ padding:"14px 16px", background:"rgba(59,130,246,0.06)", border:"1px solid rgba(59,130,246,0.15)", borderRadius:10, fontSize:13, color:"#8899b5", lineHeight:1.7 }}>
                          <strong style={{ color:"#3b82f6" }}>Komentarz egzaminatora:</strong><br/>{synthScore.feedback}
                        </div>
                      )}
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {/* ==================== STATS ==================== */}
          {panel==="stats" && (
            <div className="animate-fade-in">
              <div style={{ marginBottom:24 }}>
                <h2 className="font-display" style={{ fontSize:22, fontWeight:800, color:"#e8edf5", marginBottom:4 }}>Twoje statystyki</h2>
                <p style={{ fontSize:14, color:"#8899b5" }}>Sledz swoje postepy w przygotowaniach do matury</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
                {[{l:"Czas nauki",v:"24h",c:"#3b82f6",sub:"ten miesiac"},{l:"Najlepszy wynik",v:"28/35",c:"#10b981",sub:"rozprawka"},{l:"Zadan mat.",v:"84",c:"#e8edf5",sub:"76% trafnych"},{l:"Notatek syntezy",v:"8",c:"#06b6d4",sub:"sr. 11/15 pkt"}].map(s => (
                  <Card key={s.l}>
                    <div style={{ fontSize:12, color:"#4a5f7a", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>{s.l}</div>
                    <div className="font-display" style={{ fontSize:28, fontWeight:800, color:s.c, marginBottom:4 }}>{s.v}</div>
                    <div style={{ fontSize:12, color:"#8899b5" }}>{s.sub}</div>
                  </Card>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                <Card>
                  <SectionTitle>Streak nauki</SectionTitle>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:28 }}>&#128293;</span>
                    <span className="font-display" style={{ fontSize:36, fontWeight:800, color:"#f59e0b" }}>7</span>
                    <span style={{ fontSize:13, color:"#8899b5" }}>dni z rzedu</span>
                  </div>
                  <div style={{ fontSize:13, color:"#8899b5" }}>Twoj rekord: <strong style={{ color:"#f59e0b" }}>12 dni</strong>. Tak trzymaj!</div>
                </Card>
                <Card>
                  <SectionTitle>Postep tygodniowy</SectionTitle>
                  <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:60 }}>
                    {[30,60,45,80,55,90,70].map((h,i) => <div key={i} className="chart-bar" style={{ height:`${h}%`, background:i>=5?"#8b5cf6":"#3b82f6" }}/>)}
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:11, color:"#4a5f7a" }}>
                    {["Pon","Wt","Sr","Czw","Pt","Sob","Nd"].map(d => <span key={d}>{d}</span>)}
                  </div>
                </Card>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

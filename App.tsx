import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  BookOpen, RefreshCw, Send, ChevronRight, CheckCircle2, AlertCircle, 
  Sparkles, Lightbulb, Mic, Square, Loader2, GraduationCap, XCircle, 
  ArrowRight, BarChart3 
} from 'lucide-react';

// --- CONFIGURACIÓN Y TIPOS ---

// Inicializar cliente Gemini
// Nota: En Vercel, asegúrate de añadir la variable de entorno API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type AppState = 'TOPIC_SELECTION' | 'GENERATING_IMAGE' | 'DESCRIBING' | 'ANALYZING' | 'FEEDBACK';

interface Topic {
  id: string;
  title: string;
  description: string;
  icon: string;
  vocabulary: string[];
}

interface FeedbackResponse {
  grammarCorrections: { error: string; correction: string; explanation: string }[];
  vocabularySuggestions: string[];
  coherenceCheck: string;
  score: number;
  scoreBreakdown: { grammar: number; vocabulary: number; coherence: number };
  generalAdvice: string;
}

const TOPICS: Topic[] = [
  { 
    id: 'environment', title: 'El Medio Ambiente', icon: '🌍',
    description: 'Problemas ecológicos, reciclaje, cambio climático y naturaleza.', 
    vocabulary: ['Sostenibilidad', 'Contaminación', 'Reciclaje', 'Energías renovables', 'Cambio climático', 'Biodiversidad']
  },
  { 
    id: 'technology', title: 'Nuevas Tecnologías', icon: '💻',
    description: 'El impacto de internet, móviles, redes sociales y el futuro.', 
    vocabulary: ['Inteligencia artificial', 'Digitalización', 'Redes sociales', 'Automatización', 'Ciberseguridad']
  },
  { 
    id: 'health', title: 'Salud y Bienestar', icon: '🏥',
    description: 'Estilos de vida, deporte, alimentación y medicina.', 
    vocabulary: ['Dieta equilibrada', 'Sedentarismo', 'Bienestar mental', 'Hábitos saludables', 'Prevención']
  },
  { 
    id: 'work', title: 'El Mundo Laboral', icon: '💼',
    description: 'Entrevistas, teletrabajo, desempleo y carreras profesionales.', 
    vocabulary: ['Teletrabajo', 'Conciliación', 'Productividad', 'Cualificación', 'Desempleo', 'Emprendimiento']
  },
  { 
    id: 'travel', title: 'Viajes y Turismo', icon: '✈️',
    description: 'Vacaciones, turismo sostenible, cultura y experiencias.', 
    vocabulary: ['Turismo sostenible', 'Patrimonio', 'Alojamiento', 'Destino exótico', 'Temporada alta']
  },
  { 
    id: 'housing', title: 'Vivienda y Ciudad', icon: '🏘️',
    description: 'Vida urbana vs rural, problemas de alquiler, convivencia.', 
    vocabulary: ['Alquiler', 'Zona residencial', 'Calidad de vida', 'Urbanización', 'Áreas verdes', 'Transporte público']
  },
];

// --- COMPONENTES VISUALES ---

const TopicCard = ({ topic, onClick }: { topic: Topic; onClick: (t: Topic) => void }) => (
  <button
    onClick={() => onClick(topic)}
    className="group flex flex-col items-start p-6 bg-white border border-slate-200 rounded-xl hover:shadow-lg hover:border-indigo-500 transition-all duration-300 text-left w-full h-full"
  >
    <div className="p-3 mb-4 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors text-2xl">
      {topic.icon}
    </div>
    <h3 className="text-lg font-bold text-slate-800 mb-2">{topic.title}</h3>
    <p className="text-slate-500 text-sm leading-relaxed">{topic.description}</p>
  </button>
);

const LoadingScreen = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-300">
    <div className="bg-white p-4 rounded-full shadow-lg mb-6">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
    </div>
    <h2 className="text-xl font-semibold text-slate-800 text-center max-w-md">{message}</h2>
    <p className="text-slate-400 mt-2 text-sm">Esto puede tardar unos segundos...</p>
  </div>
);

const ScoreBar = ({ label, score, colorClass }: { label: string, score: number, colorClass: string }) => (
  <div className="mb-3">
    <div className="flex justify-between items-end mb-1">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-bold ${colorClass}`}>{score}/10</span>
    </div>
    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
      <div className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${colorClass.replace('text-', 'bg-')}`} style={{ width: `${score * 10}%` }}></div>
    </div>
  </div>
);

// --- COMPONENTE PRINCIPAL ---

export default function App() {
  const [currentState, setCurrentState] = useState<AppState>('TOPIC_SELECTION');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [studentDescription, setStudentDescription] = useState<string>('');
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Audio
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 1. Generar Imagen
  const handleTopicSelect = async (topic: Topic) => {
    setSelectedTopic(topic);
    setCurrentState('GENERATING_IMAGE');
    setError(null);
    try {
      const prompt = `Una fotografía realista, clara y educativa sobre el tema: "${topic.title}". La imagen debe ser rica en detalles, adecuada para que un estudiante de español nivel B2 la describa en un examen. Sin texto en la imagen.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] }
      });
      
      let imageBase64 = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) imageBase64 = part.inlineData.data;
      }
      
      if (!imageBase64) throw new Error("No se generó imagen");
      setGeneratedImage(imageBase64);
      setCurrentState('DESCRIBING');
    } catch (err) {
      console.error(err);
      setError('Error generando la imagen. Por favor intenta de nuevo.');
      setCurrentState('TOPIC_SELECTION');
    }
  };

  // 2. Grabar Audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64String = reader.result as string;
          const base64Audio = base64String.split(',')[1];
          const mimeType = base64String.split(';')[0].split(':')[1];
          
          try {
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: {
                parts: [
                  { inlineData: { mimeType, data: base64Audio } },
                  { text: "Transcribe este audio en español, incluyendo muletillas." }
                ]
              }
            });
            const text = response.text || "";
            setStudentDescription(prev => prev ? `${prev} ${text}` : text);
          } catch(e) {
            setError("Error al transcribir.");
          } finally {
            setIsTranscribing(false);
          }
        };
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError("No se detectó micrófono.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsTranscribing(true);
    }
  };

  // 3. Evaluar Descripción
  const handleSubmitDescription = async () => {
    if (!generatedImage || !selectedTopic) return;
    setCurrentState('ANALYZING');
    try {
      const prompt = `Actúa como examinador DELE B2. El alumno describe la imagen del tema "${selectedTopic.title}". Respuesta: "${studentDescription}". Analiza en JSON: correcciones gramaticales, vocabulario sugerido, coherencia y puntuación (0-10) desglosada.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: generatedImage } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              grammarCorrections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { error: {type: Type.STRING}, correction: {type: Type.STRING}, explanation: {type: Type.STRING} }
                }
              },
              vocabularySuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              coherenceCheck: { type: Type.STRING },
              score: { type: Type.NUMBER },
              scoreBreakdown: {
                type: Type.OBJECT,
                properties: { grammar: {type: Type.NUMBER}, vocabulary: {type: Type.NUMBER}, coherence: {type: Type.NUMBER} }
              },
              generalAdvice: { type: Type.STRING }
            }
          }
        }
      });
      setFeedback(JSON.parse(response.text || "{}"));
      setCurrentState('FEEDBACK');
    } catch (err) {
      setError('Error al analizar la respuesta.');
      setCurrentState('DESCRIBING');
    }
  };

  const reset = () => {
    setGeneratedImage(null);
    setStudentDescription('');
    setFeedback(null);
    setSelectedTopic(null);
    setCurrentState('TOPIC_SELECTION');
    setError(null);
  };

  // --- RENDERIZADO ---

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl cursor-pointer" onClick={reset}>
          <BookOpen /> DELE Tutor B2
        </div>
        {currentState !== 'TOPIC_SELECTION' && (
          <button onClick={reset} className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 text-sm font-medium">
            <RefreshCw className="w-4 h-4" /> Cambiar
          </button>
        )}
      </header>

      <main className="max-w-5xl mx-auto p-4 md:py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-200">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}

        {currentState === 'TOPIC_SELECTION' && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-8">
            <div className="col-span-full text-center mb-4">
              <h1 className="text-3xl font-bold mb-2">Practica para el examen oral</h1>
              <p className="text-slate-600">Selecciona un tema para generar una imagen y practicar.</p>
            </div>
            {TOPICS.map(t => <TopicCard key={t.id} topic={t} onClick={handleTopicSelect} />)}
          </div>
        )}

        {currentState === 'GENERATING_IMAGE' && <LoadingScreen message={`Creando imagen sobre "${selectedTopic?.title}"...`} />}
        {currentState === 'ANALYZING' && <LoadingScreen message="Analizando tu respuesta..." />}

        {currentState === 'DESCRIBING' && generatedImage && selectedTopic && (
          <div className="grid lg:grid-cols-2 gap-8 mt-4">
            <div className="space-y-4">
              <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                <img src={`data:image/png;base64,${generatedImage}`} alt="Topic" className="rounded-lg w-full object-cover aspect-square" />
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <h4 className="font-bold text-indigo-800 text-sm mb-2 flex items-center gap-2"><Lightbulb className="w-4 h-4"/> Ayuda: Vocabulario</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTopic.vocabulary.map(v => (
                    <span key={v} className="bg-white text-indigo-600 px-2 py-1 rounded-md text-xs font-medium border border-indigo-100">{v}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Tu Descripción</h2>
                <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${isRecording ? 'bg-red-100 text-red-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin"/> : isRecording ? <Square className="w-4 h-4 fill-current animate-pulse"/> : <Mic className="w-4 h-4"/>}
                  {isTranscribing ? 'Procesando...' : isRecording ? 'Detener' : 'Grabar Voz'}
                </button>
              </div>
              
              <div className="relative flex-grow">
                <textarea 
                  className="w-full h-80 p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
                  placeholder="Describe lo que ves en la imagen..."
                  value={studentDescription}
                  onChange={(e) => setStudentDescription(e.target.value)}
                />
                <span className="absolute bottom-4 right-4 text-xs text-slate-400 bg-white px-2 py-1 rounded">{studentDescription.length} cars.</span>
              </div>

              <button 
                onClick={handleSubmitDescription}
                disabled={studentDescription.length < 10 || isRecording}
                className="bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Enviar <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {currentState === 'FEEDBACK' && feedback && (
          <div className="grid lg:grid-cols-3 gap-8 mt-4">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-500 font-medium">Nota Global</span>
                  <span className="text-4xl font-bold text-indigo-600">{feedback.score}</span>
                </div>
                {feedback.scoreBreakdown && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <ScoreBar label="Gramática" score={feedback.scoreBreakdown.grammar} colorClass="text-indigo-600" />
                    <ScoreBar label="Vocabulario" score={feedback.scoreBreakdown.vocabulary} colorClass="text-emerald-600" />
                    <ScoreBar label="Coherencia" score={feedback.scoreBreakdown.coherence} colorClass="text-amber-600" />
                  </div>
                )}
              </div>
              <button onClick={reset} className="w-full py-3 border-2 border-slate-200 rounded-xl font-semibold hover:border-indigo-500 hover:text-indigo-600 transition-colors">Practicar otro tema</button>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-md relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Sparkles className="w-5 h-5"/> Feedback General</h3>
                  <p className="text-indigo-50">{feedback.generalAdvice}</p>
                </div>
                <GraduationCap className="absolute top-0 right-0 text-indigo-500 w-32 h-32 transform translate-x-6 -translate-y-6 opacity-20" />
              </div>

              <div>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500"/> Correcciones</h3>
                <div className="space-y-3">
                  {feedback.grammarCorrections.map((c, i) => (
                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-2">
                        <span className="bg-red-50 text-red-600 px-2 py-1 rounded line-through text-sm font-medium">{c.error}</span>
                        <ArrowRight className="w-4 h-4 text-slate-300 hidden sm:block" />
                        <span className="bg-green-50 text-green-600 px-2 py-1 rounded text-sm font-bold">{c.correction}</span>
                      </div>
                      <p className="text-slate-600 text-sm ml-1 border-l-2 border-indigo-100 pl-2">{c.explanation}</p>
                    </div>
                  ))}
                  {feedback.grammarCorrections.length === 0 && (
                    <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5"/> ¡Perfecto! No hay errores graves.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-500"/> Vocabulario Recomendado</h3>
                <div className="flex flex-wrap gap-2">
                  {feedback.vocabularySuggestions.map((v, i) => (
                    <span key={i} className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-slate-700 font-medium">{v}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
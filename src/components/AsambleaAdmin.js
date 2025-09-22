import React, { useState, useEffect } from 'react';  
import { motion } from 'framer-motion';  
import { Shield, Plus, X, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';  
import { supabase } from '../utils/supabase';  
import { v4 as uuidv4 } from 'uuid';  
import jsPDF from 'jspdf';  
import html2canvas from 'html2canvas';  

const AsambleaAdmin = () => {  
  const [activeAssembly, setActiveAssembly] = useState(null);  
  const [codes, setCodes] = useState([]);  
  const [currentQuestion, setCurrentQuestion] = useState('');  
  const [questions, setQuestions] = useState([]);  
  const [showCodes, setShowCodes] = useState(false);  
  const [isGenerating, setIsGenerating] = useState(false);  
  const [isVotingActive, setIsVotingActive] = useState(false);  
  const [liveVotes, setLiveVotes] = useState({});  
  const [error, setError] = useState('');  
  const [success, setSuccess] = useState('');  

  useEffect(() => {  
    fetchActiveAssembly();  
    setupRealtimeListeners();  

    return () => {  
      supabase.removeAllChannels();  
    };  
  }, []);  

  const setupRealtimeListeners = () => {  
    // Escuchar asambleas  
    supabase  
      .channel('assemblies')  
      .on(  
        'postgres_changes',  
        { event: '*', schema: 'public', table: 'assemblies' },  
        (payload) => fetchActiveAssembly()  
      )  
      .subscribe();  

    // Escuchar votos para resultados en vivo  
    const votesSub = supabase  
      .channel('votes')  
      .on(  
        'postgres_changes',  
        { event: 'INSERT', schema: 'public', table: 'votes' },  
        () => fetchLiveVotes()  
      )  
      .subscribe();  
  };  

  const fetchActiveAssembly = async () => {  
    try {  
      const { data } = await supabase  
        .from('assemblies')  
        .select('*')  
        .eq('active', true)  
        .single();  

      setActiveAssembly(data);  
      if (data) {  
        fetchCodes(data.id);  
        fetchQuestions(data.id);  
        fetchLiveVotes();  
      } else {  
        setCodes([]);  
        setQuestions([]);  
        setShowCodes(false);  
      }  
    } catch (err) {  
      setError(`No se puede conectar al guardadatos: ${err.message || 'Revisa tu configuración'}. Asegúrate de haber puesto la URL y clave correctas en el conector.`);  
    }  
  };  

  const fetchCodes = async (assemblyId) => {  
    try {  
      const { data } = await supabase  
        .from('codes')  
        .select('*')  
        .eq('assembly_id', assemblyId);  
      setCodes(data || []);  
    } catch (err) {  
      setError(`Error cargando códigos: ${err.message}`);  
    }  
  };  

  const fetchQuestions = async (assemblyId) => {  
    try {  
      const { data } = await supabase  
        .from('questions')  
        .select('*')  
        .eq('assembly_id', assemblyId)  
        .order('order_number', { ascending: true });  
      setQuestions(data || []);  
      setIsVotingActive((data || []).some(q => q.active));  
    } catch (err) {  
      setError(`Error cargando preguntas: ${err.message}`);  
    }  
  };  

  const fetchLiveVotes = async () => {  
    if (!activeAssembly || !questions.length) return;  

    try {  
      const activeQ = questions.find(q => q.active);  
      if (!activeQ) return;  

      const { data } = await supabase  
        .from('votes')  
        .select('option, weight')  
        .eq('question_id', activeQ.id);  

      const voteCounts = { 'A favor': 0, 'En contra': 0, 'Abstenerse': 0 };  
      data.forEach(vote => voteCounts[vote.option] += vote.weight || 1);  

      setLiveVotes(voteCounts);  
    } catch (err) {  
      console.error('Error fetching votes:', err);  
    }  
  };  

  const startAssembly = async () => {  
    setIsGenerating(true);  
    setError('');  
    setSuccess('');  

    try {  
      // Primero, chequear conexión básica  
      const { data: health } = await supabase.from('assemblies').select('count').limit(0); // Ping simple  
      if (!health) {  
        throw new Error('No se puede conectar. Verifica la URL y clave en el conector.');  
      }  

      const { data: newAssembly, error: assemblyError } = await supabase  
        .from('assemblies')  
        .insert({ active: true, name: `Asamblea ${new Date().toLocaleDateString()}` })  
        .select()  
        .single();  

      if (assemblyError) {  
        throw new Error(`Error creando asamblea: ${assemblyError.message}. Revisa si las tablas existen en tu guardadatos.`);  
      }  

      // Generar 78 códigos únicos  
      const newCodes = [];  
      for (let i = 1; i <= 78; i++) {  
        const code = `COV${String(i).padStart(3, '0')}-${uuidv4().slice(0, 4).toUpperCase()}`;  
        newCodes.push({  
          assembly_id: newAssembly.id,  
          code,  
          votes_count: 1  
        });  
      }  

      const { error: codesError } = await supabase  
        .from('codes')  
        .insert(newCodes);  

      if (codesError) {  
        throw new Error(`Error generando códigos: ${codesError.message}. Asegúrate de que la tabla 'codes' permita inserts.`);  
      }  

      setSuccess('¡Asamblea iniciada exitosamente! Códigos generados (muestra los primeros para no abrumar).');  
      setShowCodes(true);  
      fetchActiveAssembly(); // Recarga todo  
    } catch (err) {  
      setError(`¡Ups! ${err.message}. Si ves algo sobre "URL" o "clave", ve al archivo del conector y pon tus datos de Supabase. Si es sobre tablas, asegúrate de haber corrido el SQL de antes.`);  
    } finally {  
      setIsGenerating(false);  
    }  
  };  

  const addQuestion = async () => {  
    if (!currentQuestion.trim() || !activeAssembly) return;  

    try {  
      const orderNum = questions.length + 1;  
      const { error } = await supabase  
        .from('questions')  
        .insert({  
          assembly_id: activeAssembly.id,  
          text: currentQuestion.trim(),  
          active: true,  
          order_number: orderNum  
        });  

      if (error) {  
        throw new Error(`Error agregando pregunta: ${error.message}`);  
      }  

      setSuccess('¡Pregunta agregada y activada!');  
      setCurrentQuestion('');  
      fetchQuestions(activeAssembly.id);  

      // Desactivar preguntas anteriores  
      await supabase  
        .from('questions')  
        .update({ active: false })  
        .eq('assembly_id', activeAssembly.id)  
        .lt('order_number', orderNum);  
    } catch (err) {  
      setError(`Error en pregunta: ${err.message}`);  
    }  
  };  

  const endCurrentVote = async () => {  
    if (!activeAssembly || !questions.length) return;  

    try {  
      const activeQ = questions.find(q => q.active);  
      if (!activeQ) return;  

      const { error } = await supabase  
        .from('questions')  
        .update({ active: false })  
        .eq('id', activeQ.id);  

      if (error) {  
        throw new Error(`Error finalizando: ${error.message}`);  
      }  

      setSuccess('¡Votación finalizada!');  
      fetchQuestions(activeAssembly.id);  
    } catch (err) {  
      setError(`Error al finalizar: ${err.message}`);  
    }  
  };  

  const endAssembly = async () => {  
    if (!activeAssembly) return;  

    try {  
      // Finalizar asamblea  
      const { error: endError } = await supabase  
        .from('assemblies')  
        .update({ active: false, ended_at: new Date().toISOString() })  
        .eq('id', activeAssembly.id);  

      if (endError) {  
        throw new Error(`Error finalizando: ${endError.message}`);  
      }  

      // Desactivar todas las preguntas  
      await supabase  
        .from('questions')  
        .update({ active: false })  
        .eq('assembly_id', activeAssembly.id);  

      setSuccess('¡Asamblea finalizada! Generando reporte...');  
      generateReport();  
    } catch (err) {  
      setError(`Error al cerrar: ${err.message}`);  
    }  
  };  

  const generateReport = async () => {  
    if (!activeAssembly) return;  

    try {  
      const { data: allQuestions } = await supabase  
        .from('questions')  
        .select('*')  
        .eq('assembly_id', activeAssembly.id)  
        .order('order_number');  

      let reportContent = `Resultados de la Asamblea: ${activeAssembly.name || 'General'}\n\n`;  

      for (let q of allQuestions) {  
        const { data: qVotes } = await supabase  
          .from('votes')  
          .select('option, weight')  
          .eq('question_id', q.id);  

        const counts = { 'A favor': 0, 'En contra': 0, 'Abstenerse': 0 };  
        qVotes.forEach(v => counts[v.option] += v.weight || 1);  

        reportContent += `Pregunta ${q.order_number}: ${q.text}\n`;  
        reportContent += `A favor: ${counts['A favor']}\n`;  
        reportContent += `En contra: ${counts['En contra']}\n`;  
        reportContent += `Abstenerse: ${counts['Abstenerse']}\n`;  
        reportContent += `Total: ${Object.values(counts).reduce((a, b) => a + b, 0)}\n\n`;  
      }  

      // Generar PDF  
      const doc = new jsPDF();  
      doc.text(reportContent, 10, 10);  
      doc.save(`resultados-asamblea-${activeAssembly.id.slice(0, 8)}.pdf`);  

      setSuccess('¡Reporte descargado como PDF!');  
      fetchActiveAssembly();  
    } catch (err) {  
      setError(`Error en reporte: ${err.message}`);  
    }  
  };  

  return (  
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 pt-20">  
      <div className="container mx-auto px-4 py-8 max-w-4xl">  
        <motion.div  
          initial={{ opacity: 0, y: 20 }}  
          animate={{ opacity: 1, y: 0 }}  
          className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-200/50 space-y-8"  
        >  
          <div className="text-center">  
            <Shield className="w-16 h-16 text-purple-600 mx-auto mb-4" />  
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Panel de Admin - Asamblea</h1>  
            <p className="text-gray-600">Controla las votaciones y ve resultados en vivo.</p>  
          </div>  

          {!activeAssembly ? (  
            <motion.button  
              onClick={startAssembly}  
              disabled={isGenerating}  
              whileHover={{ scale: 1.05 }}  
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50"  
            >  
              {isGenerating ? 'Generando...' : 'Iniciar Nueva Asamblea'}  
            </motion.button>  
          ) : (  
            <>  
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-200">  
                <h2 className="text-xl font-semibold mb-4">Asamblea Activa</h2>  
                <p className="text-gray-700">ID: {activeAssembly.id.slice(0, 8)}... | Iniciada: {new Date(activeAssembly.started_at).toLocaleString()}</p>  

                {showCodes && (  
                  <div className="mt-4 p-4 bg-white rounded-xl">  
                    <h3 className="font-semibold mb-2">Códigos Generados ({codes.length}/78)</h3>  
                    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">  
                      {codes.slice(0, 16).map(code => (  
                        <span key={code.id} className="px-2 py-1 bg-gray-100 rounded text-xs">  
                          {code.code}  
                        </span>  
                      ))}  
                    </div>  
                    {codes.length > 16 && <p className="text-xs text-gray-500 mt-2">... y más (total 78)</p>}  
                  </div>  
                )}  
              </div>  

              <div className="space-y-4">  
                <input  
                  type="text"  
                  placeholder="Escribe la nueva pregunta de votación..."  
                  value={currentQuestion}  
                  onChange={(e) => setCurrentQuestion(e.target.value)}  
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"  
                />  
                <div className="flex gap-4">  
                  <motion.button  
                    onClick={addQuestion}  
                    disabled={!currentQuestion.trim() || !activeAssembly}  
                    whileHover={{ scale: 1.05 }}  
                    className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-semibold disabled:opacity-50"  
                  >  
                    <Plus className="w-4 h-4 mr-2 inline" />  
                    Agregar Pregunta  
                  </motion.button>  
                  {isVotingActive && (  
                    <motion.button  
                      onClick={endCurrentVote}  
                      whileHover={{ scale: 1.05 }}  
                      className="px-6 py-3 bg-yellow-500 text-white rounded-xl font-semibold"  
                    >  
                      <X className="w-4 h-4 mr-2 inline" />  
                      Finalizar Votación  
                    </motion.button>  
                  )}  
                </div>  
              </div>  

              {questions.length > 0 && (  
                <div className="space-y-4">  
                  <h3 className="text-lg font-semibold flex items-center gap-2">  
                    Preguntas ({questions.length})  
                  </h3>  
                  {questions.map(q => (  
                    <div key={q.id} className={`p-4 rounded-xl border ${q.active ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>  
                      <div className="flex justify-between items-start">  
                        <span className="font-medium">{q.text}</span>  
                        {q.active && <CheckCircle2 className="w-5 h-5 text-green-500" />}  
                      </div>  
                    </div>  
                  ))}  
                </div>  
              )}  

              {isVotingActive && Object.keys(liveVotes).length > 0 && (  
                <div className="p-6 bg-green-50 rounded-2xl border border-green-200">  
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">  
                    <Users className="w-5 h-5 text-green-600" />  
                    Resultados en Vivo  
                  </h3>  
                  <div className="space-y-2">  
                    <div className="flex justify-between">  
                      <span>A Favor:</span>  
                      <span className="font-bold text-green-600">{liveVotes['A favor'] || 0}</span>  
                    </div>  
                    <div className="flex justify-between">  
                      <span>En Contra:</span>  
                      <span className="font-bold text-red-600">{liveVotes['En contra'] || 0}</span>  
                    </div>  
                    <div className="flex justify-between">  
                      <span>Abstenerse:</span>  
                      <span className="font-bold text-gray-600">{liveVotes['Abstenerse'] || 0}</span>  
                    </div>  
                    <div className="flex justify-between pt-2 border-t font-bold">  
                      <span>Total:</span>  
                      <span>{Object.values(liveVotes).reduce((a, b) => a + b, 0)}</span>  
                    </div>  
                  </div>  
                </div>  
              )}  

              <motion.button  
                onClick={endAssembly}  
                whileHover={{ scale: 1.05 }}  
                className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl font-semibold shadow-lg"  
              >  
                <Download className="w-5 h-5 inline mr-2" />  
                Finalizar Asamblea y Descargar Resultados  
              </motion.button>  
            </>  
          )}  

          {error && (  
            <motion.div  
              initial={{ opacity: 0 }}  
              animate={{ opacity: 1 }}  
              className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"  
            >  
              <AlertTriangle className="w-5 h-5 text-red-500" />  
              {error}  
            </motion.div>  
          )}  

          {success && (  
            <motion.div  
              initial={{ opacity: 0 }}  
              animate={{ opacity: 1 }}  
              className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3"  
            >  
              <CheckCircle2 className="w-5 h-5 text-green-500" />  
              {success}  
            </motion.div>  
          )}  
        </motion.div>  
      </div>  
    </div>  
  );  
};  

export default AsambleaAdmin;
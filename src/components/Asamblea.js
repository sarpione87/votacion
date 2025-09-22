import React, { useState, useEffect } from 'react';  
import { motion } from 'framer-motion';  
import { Users, Check, X, AlertCircle } from 'lucide-react';  
import { supabase } from '../utils/supabase';  
import { v4 as uuidv4 } from 'uuid';  

const Asamblea = () => {  
  const [codes, setCodes] = useState(['', '']);  
  const [voteWeight, setVoteWeight] = useState(0);  
  const [currentQuestion, setCurrentQuestion] = useState(null);  
  const [votes, setVotes] = useState({});  
  const [isVotingActive, setIsVotingActive] = useState(false);  
  const [error, setError] = useState('');  
  const [success, setSuccess] = useState('');  

  useEffect(() => {  
    fetchCurrentQuestion();  
    // Escuchar cambios en tiempo real para la pregunta actual y votos  
    const questionSubscription = supabase  
      .channel('questions')  
      .on(  
        'postgres_changes',  
        {  
          event: '*',  
          schema: 'public',  
          table: 'questions',  
          filter: 'active=eq.true'  
        },  
        (payload) => {  
          fetchCurrentQuestion();  
          fetchLiveVotes();  
        }  
      )  
      .subscribe();  

    const votesSubscription = supabase  
      .channel('votes')  
      .on(  
        'postgres_changes',  
        {  
          event: 'INSERT',  
          schema: 'public',  
          table: 'votes'  
        },  
        () => fetchLiveVotes()  
      )  
      .subscribe();  

    fetchLiveVotes();  

    return () => {  
      supabase.removeChannel(questionSubscription);  
      supabase.removeChannel(votesSubscription);  
    };  
  }, []);  

  const fetchCurrentQuestion = async () => {  
    const { data: activeAssembly } = await supabase  
      .from('assemblies')  
      .select('id')  
      .eq('active', true)  
      .single();  

    if (activeAssembly) {  
      const { data } = await supabase  
        .from('questions')  
        .select('*')  
        .eq('assembly_id', activeAssembly.id)  
        .eq('active', true)  
        .order('order_number', { ascending: true })  
        .single();  

      setCurrentQuestion(data);  
      setIsVotingActive(!!data);  
      setSuccess(data ? '¡Pregunta activa! Vota ahora.' : '');  
    } else {  
      setCurrentQuestion(null);  
      setIsVotingActive(false);  
      setSuccess('');  
    }  
  };  

  const fetchLiveVotes = async () => {  
    if (!currentQuestion) return;  

    const { data } = await supabase  
      .from('votes')  
      .select('option')  
      .eq('question_id', currentQuestion.id);  

    const voteCounts = { 'A favor': 0, 'En contra': 0, 'Abstenerse': 0 };  
    data.forEach(vote => voteCounts[vote.option] += vote.weight || 1);  

    setVotes(voteCounts);  
  };  

  const handleCodeChange = (index, value) => {  
    const newCodes = [...codes];  
    newCodes[index] = value;  
    setCodes(newCodes);  
    setError('');  
    setSuccess('');  
  };  

  const validateCodes = async () => {  
    const validCodes = [];  
    let totalWeight = 0;  

    for (let code of codes) {  
      if (code.trim()) {  
        const { data, error } = await supabase  
          .from('codes')  
          .select('id, used, votes_count')  
          .eq('code', code.trim())  
          .eq('used', false)  
          .single();  

        if (error || !data) {  
          setError(`Código ${code} inválido o ya usado.`);  
          return;  
        }  
        validCodes.push(data);  
        totalWeight += data.votes_count;  
      }  
    }  

    if (validCodes.length === 0) {  
      setError('Ingresa al menos un código válido.');  
      return;  
    }  

    setVoteWeight(totalWeight);  
    setError('');  
    setSuccess(`¡Votos listos! Tu voto vale ${totalWeight} punto${totalWeight > 1 ? 's' : ''}.`);  
    return validCodes;  
  };  

  const castVote = async (option) => {  
    const validCodes = await validateCodes();  
    if (!validCodes || !currentQuestion) return;  

    for (let codeData of validCodes) {  
      const { error } = await supabase  
        .from('votes')  
        .insert({  
          question_id: currentQuestion.id,  
          code_id: codeData.id,  
          option,  
          weight: codeData.votes_count  
        });  

      if (error) {  
        setError('Error al votar. Intenta de nuevo.');  
        return;  
      }  

      // Marcar códigos como usados  
      await supabase  
        .from('codes')  
        .update({ used: true })  
        .eq('id', codeData.id);  
    }  

    setCodes(['', '']);  
    setVoteWeight(0);  
    setSuccess(`¡Voto ${option} registrado! Gracias por participar.`);  
    fetchLiveVotes();  
  };  

  return (  
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 pt-20">  
      <div className="container mx-auto px-4 py-8 max-w-2xl">  
        <motion.div  
          initial={{ opacity: 0, y: 20 }}  
          animate={{ opacity: 1, y: 0 }}  
          className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-200/50"  
        >  
          <div className="text-center mb-8">  
            <Users className="w-16 h-16 text-blue-600 mx-auto mb-4" />  
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Tu Voto en la Asamblea</h1>  
            <p className="text-gray-600">Ingresa tus códigos para votar en la pregunta actual.</p>  
          </div>  

          {currentQuestion && (  
            <motion.div  
              initial={{ scale: 0.95 }}  
              animate={{ scale: 1 }}  
              className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200"  
            >  
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Pregunta Actual:</h2>  
              <p className="text-gray-700 italic">"{currentQuestion.text}"</p>  
            </motion.div>  
          )}  

          {error && (  
            <motion.div  
              initial={{ opacity: 0 }}  
              animate={{ opacity: 1 }}  
              className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"  
            >  
              <AlertCircle className="w-5 h-5 text-red-500" />  
              {error}  
            </motion.div>  
          )}  

          {success && (  
            <motion.div  
              initial={{ opacity: 0 }}  
              animate={{ opacity: 1 }}  
              className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3"  
            >  
              <Check className="w-5 h-5 text-green-500" />  
              {success}  
            </motion.div>  
          )}  

          {!isVotingActive ? (  
            <motion.div  
              initial={{ opacity: 0 }}  
              animate={{ opacity: 1 }}  
              className="text-center py-12"  
            >  
              <X className="w-12 h-12 text-gray-400 mx-auto mb-4" />  
              <p className="text-gray-500">No hay votación activa en este momento. Espera a que inicie.</p>  
            </motion.div>  
          ) : (  
            <>  
              <div className="space-y-4 mb-8">  
                <label className="block text-sm font-medium text-gray-700">Ingresa Código 1 (opcional):</label>  
                <input  
                  type="text"  
                  placeholder="Ej: COV001-ABCD"  
                  value={codes[0]}  
                  onChange={(e) => handleCodeChange(0, e.target.value)}  
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"  
                />  
                <label className="block text-sm font-medium text-gray-700">Ingresa Código 2 (opcional, para voto doble):</label>  
                <input  
                  type="text"  
                  placeholder="Ej: COV002-EFGH"  
                  value={codes[1]}  
                  onChange={(e) => handleCodeChange(1, e.target.value)}  
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"  
                />  
                {voteWeight > 0 && (  
                  <p className="text-green-600 font-semibold">Voto válido: {voteWeight} punto{voteWeight > 1 ? 's' : ''}</p>  
                )}  
              </div>  

              <div className="grid grid-cols-1 gap-4 mb-8">  
                <motion.button  
                  onClick={() => castVote('A favor')}  
                  disabled={voteWeight === 0}  
                  whileHover={{ scale: 1.05 }}  
                  className="px-6 py-4 bg-green-500 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"  
                >  
                  A Favor  
                </motion.button>  
                <motion.button  
                  onClick={() => castVote('En contra')}  
                  disabled={voteWeight === 0}  
                  whileHover={{ scale: 1.05 }}  
                  className="px-6 py-4 bg-red-500 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"  
                >  
                  En Contra  
                </motion.button>  
                <motion.button  
                  onClick={() => castVote('Abstenerse')}  
                  disabled={voteWeight === 0}  
                  whileHover={{ scale: 1.05 }}  
                  className="px-6 py-4 bg-gray-500 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"  
                >  
                  Abstenerse  
                </motion.button>  
              </div>  

              <div className="p-6 bg-gray-50 rounded-2xl">  
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">  
                  <Users className="w-5 h-5" />  
                  Resultados en Vivo  
                </h3>  
                <div className="space-y-2">  
                  <div className="flex justify-between">  
                    <span>A Favor:</span>  
                    <span className="font-bold text-green-600">{votes['A favor'] || 0}</span>  
                  </div>  
                  <div className="flex justify-between">  
                    <span>En Contra:</span>  
                    <span className="font-bold text-red-600">{votes['En contra'] || 0}</span>  
                  </div>  
                  <div className="flex justify-between">  
                    <span>Abstenerse:</span>  
                    <span className="font-bold text-gray-600">{votes['Abstenerse'] || 0}</span>  
                  </div>  
                  <div className="flex justify-between pt-2 border-t">  
                    <span>Total Votos:</span>  
                    <span className="font-bold">{(votes['A favor'] || 0) + (votes['En contra'] || 0) + (votes['Abstenerse'] || 0)}</span>  
                  </div>  
                </div>  
              </div>  
            </>  
          )}  
        </motion.div>  
      </div>  
    </div>  
  );  
};  

export default Asamblea;
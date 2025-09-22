import React from 'react';  
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';  
import { motion } from 'framer-motion';  
import Navbar from './components/Navbar';  
import Asamblea from './components/Asamblea';  
import AsambleaAdmin from './components/AsambleaAdmin';  

const App = () => {  
  return (  
    <Router>  
      <div className="min-h-screen">  
        <Navbar />  
        <Routes>  
          <Route path="/" element={  
            <motion.div  
              initial={{ opacity: 0 }}  
              animate={{ opacity: 1 }}  
              className="pt-20 text-center py-8"  
            >  
              <h1 className="text-4xl font-bold text-gray-800 mb-4">¡Bienvenido a VotaFacil!</h1>  
              <p className="text-gray-600 max-w-md mx-auto">Sistema de votaciones para asambleas. Usa /asamblea para votar o /asambleadmin para administrar.</p>  
            </motion.div>  
          } />  
          <Route path="/asamblea" element={<Asamblea />} />  
          <Route path="/asambleadmin" element={<AsambleaAdmin />} />  
        </Routes>  
      </div>  
    </Router>  
  );  
};  

export default App;
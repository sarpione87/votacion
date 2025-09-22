import React from 'react';  
import { motion } from 'framer-motion';  
import { Home, Users, Shield } from 'lucide-react';  
import { Link } from 'react-router-dom';  

const Navbar = () => {  
  return (  
    <motion.nav  
      initial={{ y: -100 }}  
      animate={{ y: 0 }}  
      className="bg-white/90 backdrop-blur-xl border-b border-gray-200/50 shadow-lg fixed top-0 left-0 right-0 z-50"  
    >  
      <div className="container mx-auto px-4 py-4">  
        <div className="flex items-center justify-between">  
          <Link to="/" className="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">  
            <Shield className="w-8 h-8" />  
            VotaFacil  
          </Link>  
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">  
            <Link  
              to="/asamblea"  
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-white hover:text-blue-600 transition-all"  
            >  
              <Users className="w-4 h-4 inline mr-1" />  
              Asamblea  
            </Link>  
            <Link  
              to="/asambleadmin"  
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white shadow-md"  
            >  
              <Shield className="w-4 h-4 inline mr-1" />  
              Admin  
            </Link>  
          </div>  
        </div>  
      </div>  
    </motion.nav>  
  );  
};  

export default Navbar;
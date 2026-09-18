import React from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, Presentation } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
export default function SiteHeader() {
  const { theme, toggleTheme } = useTheme();
  return <header className="site-header"><Link to="/" className="site-brand"><span><Presentation size={19} /></span>MARP Studio</Link><nav aria-label="Main navigation"><Link to="/dashboard">Dashboard</Link><button onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></nav></header>;
}

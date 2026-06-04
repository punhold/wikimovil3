
import { User, UserRole, Post, DropFile, Notification, Badge } from './types';

export const INITIAL_TAGS = [
  "Datos Utiles",
  "Pases a FO",
  "Tarea Soporte",
  "reclamos energia",
  "Reclamos Edenor/Edesur/Coop.",
  "Reclamos Movistar",
  "Reclamos Claro",
  "Reclamos Satelital",
  "Reclamos Cycsa/AM Tower",
  "Reclamos Aubasa/ITTel",
  "Reclamos Metrotel",
  "Reclamos Torresec",
  "Reclamos Ufinet",
  "Pedidos de Repuesto",
  "salesforce",
  "BMC Helix"
];

// --- GAMIFICATION BADGES ---
export const BADGES: Badge[] = [
  { id: 'b1', name: 'Experto en Fibra', icon: 'fiber_manual_record', description: 'Más de 10 soluciones en FO', color: 'bg-purple-100 text-purple-700' },
  { id: 'b2', name: 'Salvador del día', icon: 'shield', description: 'Resolvió una incidencia crítica', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'b3', name: 'Mentor', icon: 'school', description: 'Ayuda constantemente a los nuevos', color: 'bg-blue-100 text-blue-700' },
  { id: 'b4', name: 'Top Contributor', icon: 'star', description: 'Más de 50 posts útiles', color: 'bg-red-100 text-red-700' }
];


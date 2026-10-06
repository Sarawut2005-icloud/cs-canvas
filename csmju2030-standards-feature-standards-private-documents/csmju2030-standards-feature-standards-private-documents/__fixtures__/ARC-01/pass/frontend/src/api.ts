import axios from 'axios';

export const getEquipmentList = () => axios.get('/v1/equipment-items');

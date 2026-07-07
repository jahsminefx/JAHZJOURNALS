import React from 'react';
import { Link } from 'react-router-dom';

const AccountTypeCard = ({ icon: Icon, title, description, to, action }) => (
  <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 transition hover:border-green-500">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
      <Icon size={24} />
    </div>
    <h3 className="mt-5 text-xl font-bold text-gray-100">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-gray-400">{description}</p>
    <Link to={to} className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-green-500 px-4 py-2.5 text-sm font-bold text-gray-900 transition hover:bg-green-400">
      {action}
    </Link>
  </div>
);

export default AccountTypeCard;

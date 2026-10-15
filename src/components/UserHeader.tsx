import { Menu, Search, Bell } from 'lucide-react';

interface UserHeaderProps {
  onMenuClick: () => void;
}

export default function UserHeader({ onMenuClick }: UserHeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <button onClick={onMenuClick} className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
        <Menu size={24} />
      </button>

      <div className="hidden md:flex flex-1 max-w-xs mx-4">
        <div className="relative w-full">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="p-2 hover:bg-gray-100 rounded-lg relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
            <span className="text-purple-600 font-semibold">U</span>
          </div>
          <div className="hidden sm:block text-sm">
            <p className="font-medium text-gray-900">User</p>
            <p className="text-gray-500 text-xs">Artist</p>
          </div>
        </div>
      </div>
    </header>
  );
}

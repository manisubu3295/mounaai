import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import type { ChatMessage } from '@pocketcomputer/shared-types';

const baseMessage: ChatMessage = {
  id: 'msg-1',
  chat_id: 'chat-1',
  role: 'USER',
  content: 'Hello, show me the sales data.',
  created_at: new Date().toISOString(),
};

const assistantMessage: ChatMessage = {
  ...baseMessage,
  id: 'msg-2',
  role: 'ASSISTANT',
  content: 'Here is the **sales data** you requested.',
  model_used: 'gemini-1.5-pro',
};

const assistantWithSources: ChatMessage = {
  ...assistantMessage,
  id: 'msg-3',
  sources: [
    { connector_id: 'c1', connector_name: 'Sales DB', connector_type: 'DB', endpoint_or_query: 'monthly_sales', fetched_at: new Date().toISOString() },
    { connector_id: 'c2', connector_name: 'CRM API', connector_type: 'API', endpoint_or_query: 'customers', fetched_at: new Date().toISOString() },
  ],
};

describe('MessageBubble', () => {
  describe('User message', () => {
    it('renders the message content', () => {
      render(<MessageBubble message={baseMessage} />);
      expect(screen.getByText('Hello, show me the sales data.')).toBeInTheDocument();
    });

    it('does not show the AI avatar', () => {
      render(<MessageBubble message={baseMessage} />);
      expect(screen.queryByText('AI')).not.toBeInTheDocument();
    });

    it('does not show a copy button', () => {
      render(<MessageBubble message={baseMessage} />);
      // Copy button only appears for assistant messages
      expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
    });
  });

  describe('Assistant message', () => {
    it('renders the AI avatar', () => {
      render(<MessageBubble message={assistantMessage} />);
      expect(screen.getByText('AI')).toBeInTheDocument();
    });

    it('renders markdown content', () => {
      render(<MessageBubble message={assistantMessage} />);
      // ReactMarkdown renders "**sales data**" as <strong>
      expect(screen.getByText('sales data')).toBeInTheDocument();
    });

    it('shows the model badge', () => {
      render(<MessageBubble message={assistantMessage} />);
      expect(screen.getByText('gemini-1.5-pro')).toBeInTheDocument();
    });
  });

  describe('Sources', () => {
    it('shows source count toggle when sources exist', () => {
      render(<MessageBubble message={assistantWithSources} />);
      expect(screen.getByText('2 sources')).toBeInTheDocument();
    });

    it('expands to show source names on click', () => {
      render(<MessageBubble message={assistantWithSources} />);
      fireEvent.click(screen.getByText('2 sources'));
      expect(screen.getByText('Sales DB')).toBeInTheDocument();
      expect(screen.getByText('CRM API')).toBeInTheDocument();
    });

    it('collapses sources on second click', () => {
      render(<MessageBubble message={assistantWithSources} />);
      const toggle = screen.getByText('2 sources');
      fireEvent.click(toggle); // expand
      fireEvent.click(toggle); // collapse
      expect(screen.queryByText('Sales DB')).not.toBeInTheDocument();
    });

    it('does not show source toggle when sources are empty', () => {
      render(<MessageBubble message={assistantMessage} />);
      expect(screen.queryByText(/source/)).not.toBeInTheDocument();
    });
  });

  describe('Copy button', () => {
    it('calls clipboard.writeText with message content', async () => {
      render(<MessageBubble message={assistantMessage} />);
      // The copy button is in the meta row; it's hidden by CSS opacity but still in the DOM
      const buttons = screen.getAllByRole('button');
      const copyBtn = buttons[0]; // first button in meta row
      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(assistantMessage.content);
    });
  });
});

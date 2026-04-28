import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import CommentComposer from '@/components/CommentComposer';
import { useToast } from '@/components/ToastProvider';

jest.mock('@/components/ToastProvider', () => ({
  useToast: jest.fn(),
}));

describe('CommentComposer', () => {
  const mockShowError = jest.fn();
  const mockShowSuccess = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as jest.Mock).mockReturnValue({
      showError: mockShowError,
      showSuccess: mockShowSuccess,
    });
  });

  it('shows connect prompt when userAddress is missing', () => {
    render(<CommentComposer onSubmit={mockOnSubmit} isSubmitting={false} />);
    expect(screen.getByText('Connect your wallet to join the conversation.')).toBeInTheDocument();
  });

  it('renders correctly when userAddress is provided', () => {
    render(
      <CommentComposer
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        userAddress="GABC123456"
      />
    );
    expect(
      screen.getByRole('button', { name: "Ask a question or leave a comment..." })
    ).toBeInTheDocument();
  });

  it('expands textarea when clicked', () => {
    render(
      <CommentComposer
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        userAddress="GABC123456"
      />
    );

    const button = screen.getByRole('button', { name: "Ask a question or leave a comment..." });
    fireEvent.click(button);

    expect(screen.getByPlaceholderText("Ask a question or leave a comment...")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post' })).toBeInTheDocument();
  });

  it('disables submit if content is too short', () => {
    render(
      <CommentComposer
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        userAddress="GABC123456"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: "Ask a question or leave a comment..." }));
    const textarea = screen.getByPlaceholderText("Ask a question or leave a comment...");
    
    fireEvent.change(textarea, { target: { value: 'Hi' } });
    const submitBtn = screen.getByRole('button', { name: 'Post' });
    expect(submitBtn).toBeDisabled();
  });

  it('submits valid content successfully', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(
      <CommentComposer
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        userAddress="GABC123456"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: "Ask a question or leave a comment..." }));
    const textarea = screen.getByPlaceholderText("Ask a question or leave a comment...");
    
    const validContent = 'This is a valid comment.';
    fireEvent.change(textarea, { target: { value: validContent } });
    
    const submitBtn = screen.getByRole('button', { name: 'Post' });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(validContent);
      expect(mockShowSuccess).toHaveBeenCalledWith('Comment posted successfully!');
    });
  });

  it('shows error if submission fails', async () => {
    mockOnSubmit.mockRejectedValueOnce(new Error('Network error'));

    render(
      <CommentComposer
        onSubmit={mockOnSubmit}
        isSubmitting={false}
        userAddress="GABC123456"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: "Ask a question or leave a comment..." }));
    const textarea = screen.getByPlaceholderText("Ask a question or leave a comment...");
    
    fireEvent.change(textarea, { target: { value: 'Valid comment text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Network error');
    });
  });
});

import { memo } from "react";
import Modal from "./ui/Modal";

const MemoizedModal = memo(Modal);

export default MemoizedModal;
export type { ModalProps } from "./ui/Modal";

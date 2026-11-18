"""One helper for every vc.* server message. Lane S1.

  async def push_server_message(target: FrameProcessor | PipelineWorker, msg: vc.protocol.Wire) -> None
      -> RTVIServerMessageFrame(data=msg.wire()) queued/pushed downstream so RTVIObserver sends it.

Never put transcript text in a VcError; never log msg payloads (booth).
"""

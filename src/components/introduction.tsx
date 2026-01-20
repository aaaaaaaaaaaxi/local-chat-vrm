import { useState, useCallback } from "react";
import { Link } from "./link";
import { ChatEngine } from "@/features/chat/chat";
import { VoiceEngine } from "@/features/messages/messages";
import { LoadingSpinnerIcon } from "./loadingSpinnerIcon";

type Props = {
  chatEngine: ChatEngine;
  openAiKey: string;
  zhipuKey: string;
  voiceEngine: VoiceEngine;
  koeiroMapKey: string;
  onChangeOpenAiKey: (openAiKey: string) => void;
  onChangeZhipuKey: (zhipuKey: string) => void;
  onChangeKoeiromapKey: (koeiromapKey: string) => void;
  onLoad: () => Promise<void>;
};
export const Introduction = ({
  chatEngine,
  openAiKey,
  zhipuKey,
  voiceEngine,
  koeiroMapKey,
  onChangeOpenAiKey,
  onChangeZhipuKey,
  onChangeKoeiromapKey,
  onLoad,
}: Props) => {
  const [opened, setOpened] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleOpenAiKeyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeOpenAiKey(event.target.value);
    },
    [onChangeOpenAiKey]
  );

  const handleZhipuKeyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeZhipuKey(event.target.value);
    },
    [onChangeZhipuKey]
  );

  const handleKoeiromapKeyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeKoeiromapKey(event.target.value);
    },
    [onChangeKoeiromapKey]
  );

  const onClickStartButton = useCallback(async () => {
    setLoading(true);
    await onLoad();
    setLoading(false);
    setOpened(false);
  }, [onLoad]);

  return opened ? (
    <div className="absolute z-40 w-full h-full px-24 py-40  bg-black/30 font-M_PLUS_2">
      <div className="mx-auto my-auto max-w-3xl max-h-full p-24 overflow-auto bg-white rounded-16">
        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary ">
            About This Application
          </div>
          <div>
            Enjoy chatting with 3D characters directly in your web browser using
            your microphone, text input, and voice synthesis. You can also
            change the character (VRM model) and customize their personality
            settings.
          </div>
        </div>
        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">
            Technology
          </div>
          <div>
            This application leverages the @pixiv/three-vrm library for 3D model
            rendering and manipulation, and supports multiple AI engines including
            Zhipu GLM and OpenAI for conversational text generation and voice synthesis.
          </div>
        </div>

        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">
            Important Notes
          </div>
          <div>
            Please refrain from intentionally prompting discriminatory, violent,
            or disparaging remarks towards specific individuals. When replacing
            characters using VRM models, please adhere to the terms of use for
            each model.
          </div>
        </div>

        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">
            AI Engine Status
          </div>
          <div className="text-sm">
            <p>Current: {chatEngine}</p>
            {(chatEngine === "Zhipu GLM" && !zhipuKey) && (
              <p className="text-red-500">⚠️ Zhipu GLM APIキーが設定されていません</p>
            )}
            {(chatEngine === "OpenAI" && !openAiKey) && (
              <p className="text-red-500">⚠️ OpenAI APIキーが設定されていません</p>
            )}
            {(chatEngine === "Zhipu GLM" && zhipuKey) && (
              <p className="text-green-500">✓ Zhipu GLM APIキーが設定されています</p>
            )}
            {(chatEngine === "OpenAI" && openAiKey) && (
              <p className="text-green-500">✓ OpenAI APIキーが設定されています</p>
            )}
          </div>
        </div>

        {voiceEngine === "Koeiromap" && (
          <div className="my-24">
            <div className="my-8 font-bold typography-20 text-secondary">
              Koeiromap API Key
            </div>
            <input
              type="text"
              placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={koeiroMapKey}
              onChange={handleKoeiromapKeyChange}
              className="my-4 px-16 py-8 w-full h-40 bg-surface3 hover:bg-surface3-hover rounded-4 text-ellipsis"
            ></input>
            <div>
              Please create your API key on rinna Developers.
              <Link
                url="https://developers.rinna.co.jp/product/#product=koeiromap-free"
                label="More info"
              />
            </div>
          </div>
        )}
        {chatEngine === "OpenAI" && (
          <div className="my-24">
            <div className="my-8 font-bold typography-20 text-secondary">
              OpenAI API Key
            </div>
            <input
              type="text"
              placeholder="sk-..."
              value={openAiKey}
              onChange={handleAiKeyChange}
              className="my-4 px-16 py-8 w-full h-40 bg-surface3 hover:bg-surface3-hover rounded-4 text-ellipsis"
            ></input>
            <div>
              You can create your API key on
              <Link
                url="https://platform.openai.com/account/api-keys"
                label="the OpenAI website"
              />
              . Please enter the created API key in the form below.
            </div>
            <div className="my-16">
              ChatGPT The API is accessed directly from your browser.
              Additionally, your API key and conversation content are not stored
              on pixiv&#39;s servers.
              <br />* The model currently in use is the ChatGPT API (GPT-3.5).
            </div>
          </div>
        )}
        {chatEngine === "Zhipu GLM" && (
          <div className="my-24">
            <div className="my-8 font-bold typography-20 text-secondary">
              Zhipu GLM API Key
            </div>
            <input
              type="text"
              placeholder="your-api-key"
              value={zhipuKey}
              onChange={handleZhipuKeyChange}
              className="my-4 px-16 py-8 w-full h-40 bg-surface3 hover:bg-surface3-hover rounded-4 text-ellipsis"
            ></input>
            <div>
              You can create your API key on
              <Link
                url="https://open.bigmodel.cn/"
                label="the Zhipu AI website"
              />
              . Please enter the created API key in the form below.
            </div>
            <div className="my-16">
              The GLM API is accessed directly from your browser.
              Additionally, your API key and conversation content are not stored
              on pixiv&#39;s servers.
              <br />* The model currently in use is GLM-4.
            </div>
          </div>
        )}
        <div className="my-24">
          <button
            onClick={onClickStartButton}
            disabled={loading}
            className="font-bold bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled text-white px-24 py-8 rounded-oval"
          >
            Get Started
          </button>
        </div>
        {loading && (
          <div className="my-16 flex font-bold">
            <div className="my-auto mr-8">
              <LoadingSpinnerIcon />
            </div>
            <div>
              Downloading and loading AI models. This may take a minute.
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null;
};

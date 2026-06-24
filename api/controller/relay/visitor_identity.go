package relay

import (
	"strings"

	"github.com/53AI/53AIHub/common/session"
	"github.com/53AI/53AIHub/model"
	"github.com/gin-gonic/gin"
)

func applyVisitorIdentityToConversation(c *gin.Context, conversation *model.Conversation) {
	if conversation == nil {
		return
	}
	conversation.VisitorID = strings.TrimSpace(session.GetVisitorID(c))
	if conversation.VisitorID != "" {
		conversation.Source = model.MessageRequestSourceH5
	}
}

func applyVisitorIdentityToMessage(c *gin.Context, message *model.Message) {
	if message == nil {
		return
	}
	message.VisitorID = strings.TrimSpace(session.GetVisitorID(c))
	if message.VisitorID != "" {
		message.RequestSource = model.MessageRequestSourceH5
	}
}
